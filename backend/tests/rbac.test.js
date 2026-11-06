
const request = require("supertest");
const crypto = require("crypto");
const bcrypt = require("bcrypt");

const app = require("../src/app");
const pool = require("../src/config/db");

describe("LedgerLine RBAC Integration Tests", () => {
  let holderToken;
  let auditorToken;
  let holderId;
  let auditorId;
  let accountId;

  const password = "TestPassword123";

  const uniqueEmail = (role) =>
    `rbac-${role}-${crypto.randomUUID()}@example.com`;

  // Create a user directly in the isolated test database.
  const createUser = async (role) => {
    const email = uniqueEmail(role);
    const passwordHash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO users
       (full_name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [`RBAC ${role} User`, email, passwordHash, role]
    );

    return {
      id: result.rows[0].id,
      email,
    };
  };

  // Login and obtain JWT.
  const login = async (email) => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({
        email,
        password,
      });

    expect(response.statusCode).toBe(200);
    return response.body.token;
  };

  beforeAll(async () => {
    // Safety check.
    const dbResult = await pool.query(
      "SELECT current_database() AS name"
    );

    if (dbResult.rows[0].name !== "ledgerline_test_db") {
      throw new Error(
        `Unsafe test database: ${dbResult.rows[0].name}`
      );
    }

    // Create account holder.
    const holder = await createUser("account_holder");
    holderId = holder.id;
    holderToken = await login(holder.email);

    // Create auditor.
    const auditor = await createUser("auditor");
    auditorId = auditor.id;
    auditorToken = await login(auditor.email);

    // Create customer account using holder token.
    const accountResponse = await request(app)
      .post("/api/accounts")
      .set("Authorization", `Bearer ${holderToken}`)
      .send({
        account_name: "RBAC Test Account",
      });

    expect(accountResponse.statusCode).toBe(201);

    accountId = accountResponse.body.account.id;

    // Grant auditor read-only access to this account.
    await pool.query(
      `INSERT INTO account_permissions
       (user_id, account_id, can_view,
        can_deposit, can_withdraw, can_transfer)
       VALUES ($1, $2, TRUE, FALSE, FALSE, FALSE)`,
      [auditorId, accountId]
    );
  });

  afterAll(async () => {
    await pool.end();
  });

  test("should allow account holder to create an account", async () => {
    const response = await request(app)
      .post("/api/accounts")
      .set("Authorization", `Bearer ${holderToken}`)
      .send({
        account_name: "Holder Permission Test",
      });

    expect(response.statusCode).toBe(201);
    expect(response.body.success).toBe(true);
  });

  test("should allow auditor to view a permitted account", async () => {
    const response = await request(app)
      .get(`/api/accounts/${accountId}`)
      .set("Authorization", `Bearer ${auditorToken}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
  });

  test("should prevent auditor from depositing money", async () => {
    const response = await request(app)
      .post(`/api/accounts/${accountId}/deposits`)
      .set("Authorization", `Bearer ${auditorToken}`)
      .set("Idempotency-Key", `auditor-deposit-${crypto.randomUUID()}`)
      .send({
        amount_rupees: "100.00",
      });

    expect(response.statusCode).toBe(403);
    expect(response.body.success).toBe(false);
  });

  test("should prevent auditor from withdrawing money", async () => {
    const response = await request(app)
      .post(`/api/accounts/${accountId}/withdrawals`)
      .set("Authorization", `Bearer ${auditorToken}`)
      .set("Idempotency-Key", `auditor-withdraw-${crypto.randomUUID()}`)
      .send({
        amount_rupees: "50.00",
      });

    expect(response.statusCode).toBe(403);
    expect(response.body.success).toBe(false);
  });

  test("should reject requests without an authentication token", async () => {
    const response = await request(app)
      .get("/api/accounts");

    expect(response.statusCode).toBe(401);
    expect(response.body.success).toBe(false);
  });

  test("should reject an inactive user using an existing token", async () => {
    await pool.query(
      `UPDATE users
       SET is_active = FALSE
       WHERE id = $1`,
      [holderId]
    );

    const response = await request(app)
      .get("/api/accounts")
      .set("Authorization", `Bearer ${holderToken}`);

    expect(response.statusCode).toBe(403);
    expect(response.body.success).toBe(false);
  });
});
