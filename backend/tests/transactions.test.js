
const request = require("supertest");
const crypto = require("crypto");
const app = require("../src/app");
const pool = require("../src/config/db");

describe("LedgerLine Transaction Integration Tests", () => {
  let token;

  const uniqueEmail = `ledgerline-test-${crypto.randomUUID()}@example.com`;
  const password = "TestPassword123";

  // Create a fresh account for each test.
  const createTestAccount = async () => {
    const response = await request(app)
      .post("/api/accounts")
      .set("Authorization", `Bearer ${token}`)
      .send({ account_name: `Test Account ${crypto.randomUUID()}` });

    expect(response.statusCode).toBe(201);
    expect(response.body.success).toBe(true);

    return response.body.account.id;
  };

  // Deposit money to fund an account.
  const deposit = async (accountId, amount, key) => {
    return request(app)
      .post(`/api/accounts/${accountId}/deposits`)
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", key)
      .send({ amount_rupees: amount });
  };
  
  // Transfer money between two test accounts.
  const transfer = async (sourceAccountId, targetAccountId, amount, key) => {
    return request(app)
      .post(`/api/accounts/${sourceAccountId}/transfers`)
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", key)
      .send({
        target_account_id: targetAccountId,
        amount_rupees: amount
      });
  };

  // Get the latest account balance.
  const getBalance = async (accountId) => {
    const response = await request(app)
      .get(`/api/accounts/${accountId}/balance`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.statusCode).toBe(200);

    return Number(response.body.balance.balance_paise);
  };

  beforeAll(async () => {
    // Safety check: never run tests against the development DB.
    const dbResult = await pool.query(
      "SELECT current_database() AS name"
    );

    if (dbResult.rows[0].name !== "ledgerline_test_db") {
      throw new Error(
        `Unsafe test database: ${dbResult.rows[0].name}. Expected ledgerline_test_db.`
      );
    }

    // Register a unique test user.
    const registerResponse = await request(app)
      .post("/api/auth/register")
      .send({
        full_name: "LedgerLine Test User",
        email: uniqueEmail,
        password,
      });

    expect(registerResponse.statusCode).toBe(201);

    // Log in and obtain JWT.
    const loginResponse = await request(app)
      .post("/api/auth/login")
      .send({
        email: uniqueEmail,
        password,
      });

    expect(loginResponse.statusCode).toBe(200);
    expect(loginResponse.body.token).toBeDefined();

    token = loginResponse.body.token;
  });

  afterAll(async () => {
    await pool.end();
  });

  // TEST 1: Successful deposit.
  test("should deposit money successfully", async () => {
    const accountId = await createTestAccount();

    const response = await deposit(
      accountId,
      "100.00",
      `deposit-${crypto.randomUUID()}`
    );

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.transaction.type).toBe("deposit");
    expect(response.body.transaction.status).toBe("posted");
    expect(Number(response.body.account.balance_paise)).toBe(10000);
  });

  // TEST 2: Double-entry ledger verification.
  test("should maintain equal debit and credit entries for a posted deposit", async () => {
    const accountId = await createTestAccount();

    const response = await deposit(
      accountId,
      "100.00",
      `ledger-check-${crypto.randomUUID()}`
    );

    expect(response.statusCode).toBe(200);

    const transactionId = response.body.transaction.id;

    const result = await pool.query(
      `SELECT
         COUNT(*) AS entry_count,
         COALESCE(SUM(amount_paise) FILTER (
           WHERE entry_side = 'debit'
         ), 0) AS total_debit,
         COALESCE(SUM(amount_paise) FILTER (
           WHERE entry_side = 'credit'
         ), 0) AS total_credit
       FROM ledger_entries
       WHERE transaction_id = $1`,
      [transactionId]
    );

    const ledger = result.rows[0];

    expect(Number(ledger.entry_count)).toBe(2);
    expect(Number(ledger.total_debit)).toBe(10000);
    expect(Number(ledger.total_credit)).toBe(10000);
    expect(Number(ledger.total_debit)).toBe(
      Number(ledger.total_credit)
    );
  });

  // TEST 3: Prevent ledger UPDATE.
  test("should prevent updating existing ledger entries", async () => {
    const accountId = await createTestAccount();

    const response = await deposit(
      accountId,
      "100.00",
      `update-check-${crypto.randomUUID()}`
    );

    expect(response.statusCode).toBe(200);

    const transactionId = response.body.transaction.id;

    await expect(
      pool.query(
        `UPDATE ledger_entries
         SET amount_paise = 999999
         WHERE transaction_id = $1`,
        [transactionId]
      )
    ).rejects.toThrow();
  });

  // TEST 4: Prevent ledger DELETE.
  test("should prevent deleting existing ledger entries", async () => {
    const accountId = await createTestAccount();

    const response = await deposit(
      accountId,
      "100.00",
      `delete-check-${crypto.randomUUID()}`
    );

    expect(response.statusCode).toBe(200);

    const transactionId = response.body.transaction.id;

    await expect(
      pool.query(
        `DELETE FROM ledger_entries
         WHERE transaction_id = $1`,
        [transactionId]
      )
    ).rejects.toThrow();
  });

  // TEST 5: Successful withdrawal.
  test("should withdraw money successfully", async () => {
    const accountId = await createTestAccount();

    await deposit(
      accountId,
      "100.00",
      `fund-${crypto.randomUUID()}`
    );

    const response = await request(app)
      .post(`/api/accounts/${accountId}/withdrawals`)
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", `withdraw-${crypto.randomUUID()}`)
      .send({ amount_rupees: "40.00" });

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.transaction.type).toBe("withdrawal");
    expect(Number(response.body.account.balance_paise)).toBe(6000);
  });

  // TEST 6: Duplicate deposit idempotency.
  test("should replay a duplicate deposit without adding money twice", async () => {
    const accountId = await createTestAccount();
    const key = `duplicate-${crypto.randomUUID()}`;

    const first = await deposit(accountId, "50.00", key);
    const second = await deposit(accountId, "50.00", key);

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(second.body.replayed).toBe(true);

    expect(second.body.transaction.id).toBe(
      first.body.transaction.id
    );

    expect(await getBalance(accountId)).toBe(5000);
  });

  // TEST 7: Reject idempotency key reuse with different data.
  test("should reject reuse of an idempotency key with different data", async () => {
    const accountId = await createTestAccount();
    const key = `mismatch-${crypto.randomUUID()}`;

    const first = await deposit(accountId, "50.00", key);
    const second = await deposit(accountId, "60.00", key);

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(409);
    expect(second.body.success).toBe(false);
  });

  // TEST 8: Insufficient balance protection.
  test("should reject withdrawal when balance is insufficient", async () => {
    const accountId = await createTestAccount();

    await deposit(
      accountId,
      "50.00",
      `fund-${crypto.randomUUID()}`
    );

    const response = await request(app)
      .post(`/api/accounts/${accountId}/withdrawals`)
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", `insufficient-${crypto.randomUUID()}`)
      .send({ amount_rupees: "100.00" });

    expect(response.statusCode).toBe(409);
    expect(response.body.success).toBe(false);

    expect(await getBalance(accountId)).toBe(5000);
  });

  // TEST 9: Concurrent withdrawal protection.
  test("should prevent concurrent withdrawals from overdrawing the account", async () => {
    const accountId = await createTestAccount();

    await deposit(
      accountId,
      "50.00",
      `fund-${crypto.randomUUID()}`
    );

    const firstKey = `concurrent-a-${crypto.randomUUID()}`;
    const secondKey = `concurrent-b-${crypto.randomUUID()}`;

    const [first, second] = await Promise.all([
      request(app)
        .post(`/api/accounts/${accountId}/withdrawals`)
        .set("Authorization", `Bearer ${token}`)
        .set("Idempotency-Key", firstKey)
        .send({ amount_rupees: "40.00" }),

      request(app)
        .post(`/api/accounts/${accountId}/withdrawals`)
        .set("Authorization", `Bearer ${token}`)
        .set("Idempotency-Key", secondKey)
        .send({ amount_rupees: "40.00" }),
    ]);

    const statuses = [first.statusCode, second.statusCode].sort();

    expect(statuses).toEqual([200, 409]);
    expect(await getBalance(accountId)).toBe(1000);
  });

  // TEST 10: Account balance reconciliation.
  test("should maintain account balance consistent with ledger entries", async () => {
    const accountId = await createTestAccount();

    // Deposit ₹100.
    const depositResponse = await deposit(
      accountId,
      "100.00",
      `balance-deposit-${crypto.randomUUID()}`
    );

    expect(depositResponse.statusCode).toBe(200);

    // Withdraw ₹40.
    const withdrawalResponse = await request(app)
      .post(`/api/accounts/${accountId}/withdrawals`)
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", `balance-withdraw-${crypto.randomUUID()}`)
      .send({ amount_rupees: "40.00" });

    expect(withdrawalResponse.statusCode).toBe(200);

    // Read actual account balance.
    const actualBalance = await getBalance(accountId);

    // Calculate balance from customer account ledger entries.
    const result = await pool.query(
      `SELECT
         COALESCE(
           SUM(
             CASE
               WHEN entry_side = 'credit' THEN amount_paise
               WHEN entry_side = 'debit' THEN -amount_paise
             END
           ), 0
         ) AS ledger_balance
       FROM ledger_entries
       WHERE account_id = $1`,
      [accountId]
    );

    const ledgerBalance = Number(result.rows[0].ledger_balance);

    expect(actualBalance).toBe(6000);
    expect(ledgerBalance).toBe(6000);
    expect(actualBalance).toBe(ledgerBalance);
  });
  
  // TEST 11: Successful transfer between accounts.
  test("should transfer money successfully between two accounts", async () => {
    const sourceAccountId = await createTestAccount();
    const targetAccountId = await createTestAccount();

    await deposit(
      sourceAccountId,
      "100.00",
      `transfer-fund-${crypto.randomUUID()}`
    );

    const response = await transfer(
      sourceAccountId,
      targetAccountId,
      "30.00",
      `transfer-${crypto.randomUUID()}`
    );

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.transaction.type).toBe("transfer");
    expect(response.body.transaction.status).toBe("posted");

    expect(await getBalance(sourceAccountId)).toBe(7000);
    expect(await getBalance(targetAccountId)).toBe(3000);
  });

  // TEST 12: Duplicate transfer idempotency.
  test("should not transfer money twice when the same request is replayed", async () => {
    const sourceAccountId = await createTestAccount();
    const targetAccountId = await createTestAccount();

    await deposit(
      sourceAccountId,
      "100.00",
      `transfer-fund-${crypto.randomUUID()}`
    );

    const key = `transfer-replay-${crypto.randomUUID()}`;

    const first = await transfer(
      sourceAccountId,
      targetAccountId,
      "30.00",
      key
    );

    const second = await transfer(
      sourceAccountId,
      targetAccountId,
      "30.00",
      key
    );

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);

    expect(second.body.replayed).toBe(true);

    expect(second.body.transaction.id).toBe(
      first.body.transaction.id
    );

    expect(await getBalance(sourceAccountId)).toBe(7000);
    expect(await getBalance(targetAccountId)).toBe(3000);
  });

  // TEST 13: Concurrent transfer protection.
  test("should prevent concurrent transfers from overdrawing the source account", async () => {
    const sourceAccountId = await createTestAccount();
    const targetAccountId = await createTestAccount();
    const secondTargetAccountId = await createTestAccount();

    await deposit(
      sourceAccountId,
      "50.00",
      `concurrent-transfer-fund-${crypto.randomUUID()}`
    );

    const [first, second] = await Promise.all([
      transfer(
        sourceAccountId,
        targetAccountId,
        "40.00",
        `concurrent-transfer-a-${crypto.randomUUID()}`
      ),
      transfer(
        sourceAccountId,
        secondTargetAccountId,
        "40.00",
        `concurrent-transfer-b-${crypto.randomUUID()}`
      )
    ]);

    const statuses = [first.statusCode, second.statusCode].sort();

    expect(statuses).toEqual([200, 409]);

    expect(await getBalance(sourceAccountId)).toBe(1000);

    const targetBalance = await getBalance(targetAccountId);
    const secondTargetBalance = await getBalance(secondTargetAccountId);

    expect(targetBalance + secondTargetBalance).toBe(4000);
  });

  // TEST 14: Unauthorized transfer protection.
  test("should prevent a user from transferring money from another user's account", async () => {
    const victimAccountId = await createTestAccount();

    await deposit(
      victimAccountId,
      "100.00",
      `victim-fund-${crypto.randomUUID()}`
    );

    // Register a different customer.
    const attackerEmail = `attacker-${crypto.randomUUID()}@example.com`;
    const attackerPassword = "AttackerPassword123";

    const registerResponse = await request(app)
      .post("/api/auth/register")
      .send({
        full_name: "Unauthorized Test User",
        email: attackerEmail,
        password: attackerPassword
      });

    expect(registerResponse.statusCode).toBe(201);

    // Log in as the different customer.
    const loginResponse = await request(app)
      .post("/api/auth/login")
      .send({
        email: attackerEmail,
        password: attackerPassword
      });

    expect(loginResponse.statusCode).toBe(200);

    const attackerToken = loginResponse.body.token;

    // Attempt to transfer from the victim's account.
    const response = await request(app)
      .post(`/api/accounts/${victimAccountId}/transfers`)
      .set("Authorization", `Bearer ${attackerToken}`)
      .set("Idempotency-Key", `unauthorized-${crypto.randomUUID()}`)
      .send({
        target_account_id: (await createTestAccount()),
        amount_rupees: "50.00"
      });

    expect(response.statusCode).toBe(403);
    expect(response.body.success).toBe(false);

    // Victim's money must remain unchanged.
    expect(await getBalance(victimAccountId)).toBe(10000);
  });

  // TEST 15: System-wide conservation during internal transfer.
  test("should conserve total customer money during an internal transfer", async () => {
    const sourceAccountId = await createTestAccount();
    const targetAccountId = await createTestAccount();

    await deposit(
      sourceAccountId,
      "100.00",
      `conservation-fund-${crypto.randomUUID()}`
    );

    // Measure total customer balances before transfer.
    const beforeResult = await pool.query(
      `SELECT COALESCE(SUM(balance_paise), 0) AS total
       FROM accounts
       WHERE account_type = 'customer'`
    );

    const totalBefore = BigInt(beforeResult.rows[0].total);

    // Transfer ₹30 internally.
    const response = await transfer(
      sourceAccountId,
      targetAccountId,
      "30.00",
      `conservation-transfer-${crypto.randomUUID()}`
    );

    expect(response.statusCode).toBe(200);

    // Measure total customer balances after transfer.
    const afterResult = await pool.query(
      `SELECT COALESCE(SUM(balance_paise), 0) AS total
       FROM accounts
       WHERE account_type = 'customer'`
    );

    const totalAfter = BigInt(afterResult.rows[0].total);

    expect(totalAfter).toBe(totalBefore);
  });

});
