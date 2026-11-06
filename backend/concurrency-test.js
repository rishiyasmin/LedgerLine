
const accountId = "d0cca674-0d25-4eae-aa58-bcda7ff077db";
const API_URL = `http://localhost:5000/api/accounts/${accountId}/withdrawals`;
const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjM4OGEzZWUxLTc4YWUtNGY5Mi1iZjdkLTA4MjdlOTA1ZGViZiIsInJvbGUiOiJhY2NvdW50X2hvbGRlciIsImlhdCI6MTc5Mzk2NTA4NSwiZXhwIjoxNzkzOTY4Njg1fQ.o6sUgmqxAE-d2AxUVPUAzxjx0RZeo8LUN-qh08_lV10";

async function withdraw() {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TOKEN}`,
      "Idempotency-Key": "same-key-concurrent-001"
    },
    body: JSON.stringify({
      amount_rupees: "5.00"
    })
  });

  return {
    status: response.status,
    data: await response.json()
  };
}

async function runTest() {
  console.log("Testing simultaneous duplicate requests...");

  const results = await Promise.all([
    withdraw(),
    withdraw()
  ]);

  console.log(JSON.stringify(results, null, 2));
}

runTest().catch(console.error);
