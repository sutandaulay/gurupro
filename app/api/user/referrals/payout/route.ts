import { query, logAudit } from "@/lib/db";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("gurupro_session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const session = JSON.parse(sessionCookie);
    const userId = session.id;

    // Fetch user current data
    const userRes = await query("SELECT cashback_balance, email FROM users WHERE id = $1", [userId]);
    if (userRes.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    const currentBalance = userRes.rows[0].cashback_balance || 0;
    const email = userRes.rows[0].email;

    // Fetch CMS settings
    let minPayout = 50000;
    let exchangeRate = 1000;
    const cmsRes = await query("SELECT value FROM cms_landing WHERE key = 'landing_config'");
    if (cmsRes.rows.length > 0) {
      const config = cmsRes.rows[0].value;
      if (config.min_payout_cashback !== undefined) {
        minPayout = Number(config.min_payout_cashback);
      }
      if (config.cashback_to_token_rate !== undefined) {
        exchangeRate = Number(config.cashback_to_token_rate);
      }
    }

    const { action, amount, bank_name, bank_account_number, bank_account_name } = await req.json();

    if (action === "request_payout") {
      const payoutAmount = Number(amount);
      if (isNaN(payoutAmount) || payoutAmount <= 0) {
        return NextResponse.json({ error: "Jumlah pencairan tidak valid" }, { status: 400 });
      }
      if (payoutAmount < minPayout) {
        return NextResponse.json({ error: `Minimal pencairan adalah Rp ${minPayout.toLocaleString("id-ID")}` }, { status: 400 });
      }
      if (currentBalance < payoutAmount) {
        return NextResponse.json({ error: "Saldo cashback tidak mencukupi" }, { status: 400 });
      }
      if (!bank_name || !bank_account_number || !bank_account_name) {
        return NextResponse.json({ error: "Informasi rekening bank lengkap wajib diisi untuk pencairan" }, { status: 400 });
      }

      // Deduct immediately and create request
      await query("UPDATE users SET cashback_balance = cashback_balance - $1 WHERE id = $2", [payoutAmount, userId]);
      await query(
        `INSERT INTO payout_requests (user_id, tipe, jumlah, status, catatan, bank_name, bank_account_number, bank_account_name)
         VALUES ($1, 'cashback', $2, 'PENDING', $3, $4, $5, $6)`,
        [
          userId, 
          payoutAmount, 
          `Permintaan pencairan oleh ${email}`,
          bank_name.trim(),
          bank_account_number.trim(),
          bank_account_name.trim()
        ]
      );

      // Save as default user bank details if they don't have them
      await query(
        `UPDATE users 
         SET bank_name = COALESCE(bank_name, $1),
             bank_account_number = COALESCE(bank_account_number, $2),
             bank_account_name = COALESCE(bank_account_name, $3)
         WHERE id = $4`,
        [bank_name.trim(), bank_account_number.trim(), bank_account_name.trim(), userId]
      );

      await logAudit(userId, "Permintaan Pencairan", `Mengajukan pencairan cashback Rp ${payoutAmount.toLocaleString("id-ID")} ke ${bank_name} (${bank_account_number})`);

      return NextResponse.json({ success: true, message: "Permintaan pencairan berhasil dikirim dan menunggu persetujuan admin." });
    } 
    
    if (action === "exchange_tokens") {
      const exchangeAmount = Number(amount);
      if (isNaN(exchangeAmount) || exchangeAmount <= 0) {
        return NextResponse.json({ error: "Jumlah penukaran tidak valid" }, { status: 400 });
      }
      if (currentBalance < exchangeAmount) {
        return NextResponse.json({ error: "Saldo cashback tidak mencukupi" }, { status: 400 });
      }

      const tokensToReward = Math.floor(exchangeAmount / exchangeRate);
      if (tokensToReward <= 0) {
        return NextResponse.json({ error: `Jumlah saldo terlalu kecil untuk ditukar (1 Token = Rp ${exchangeRate.toLocaleString("id-ID")})` }, { status: 400 });
      }

      const costAmount = tokensToReward * exchangeRate;

      // Process instantly
      await query(
        "UPDATE users SET cashback_balance = cashback_balance - $1, token_limit = token_limit + $2 WHERE id = $3",
        [costAmount, tokensToReward, userId]
      );

      await logAudit(userId, "Penukaran Token", `Menukar cashback Rp ${costAmount.toLocaleString("id-ID")} menjadi +${tokensToReward} Token`);

      return NextResponse.json({ 
        success: true, 
        message: `Berhasil menukar Rp ${costAmount.toLocaleString("id-ID")} menjadi +${tokensToReward} Token secara instan!` 
      });
    }

    return NextResponse.json({ error: "Aksi tidak dikenali" }, { status: 400 });
  } catch (error: any) {
    console.error("POST referrals payout error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
