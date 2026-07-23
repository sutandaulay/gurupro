import { requireSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { query } from "@/lib/db";

export default async function InstitusiRootPage() {
  const session = await requireSession();
  const activeContext = session.activeContext;

  if (!activeContext || activeContext === "individual") {
    redirect("/dashboard");
  }

  const instId = activeContext.institutionId;

  const result = await query(
    `SELECT id FROM institutions WHERE id = $1 AND status = 'active' LIMIT 1`,
    [instId]
  );

  if (result.rows.length === 0) {
    redirect("/dashboard");
  }

  redirect(`/institusi/${instId}/dashboard`);
}
