

async function main() {
  const payload = {
    id: "24e0886d-f2c8-48d7-a250-00a61bce4bbf",
    name: "Paket 50 Token Updated Test",
    token_amount: 50,
    price: 25000,
    description: "Token eceran untuk kebutuhan sesekali - updated",
    is_active: true,
    sort_order: 1
  };

  const sessionObj = { role: "admin" };
  const cookieStr = `gurupro_session=${JSON.stringify(sessionObj)}`;

  console.log("Sending PUT request to /api/admin/token-packages...");
  try {
    const res = await fetch("http://localhost:3000/api/admin/token-packages", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Cookie": cookieStr
      },
      body: JSON.stringify(payload),
      timeout: 5000
    });

    console.log("Response status:", res.status);
    const data = await res.json();
    console.log("Response data:", data);
  } catch (err) {
    console.error("Fetch error:", err);
  }
}

main();
