const request = require("supertest");
const app = require("../src/app");
const pool = require("../src/config/db");

describe("LedgerLine API Health Tests", () => {
  afterAll(async () => {
    await pool.end();
  });

  test("GET /api/health should return 200", async () => {
    const response = await request(app)
      .get("/api/health");

    expect(response.statusCode).toBe(200);

    expect(response.body).toEqual({
      success: true,
      message: "LedgerLine API is running",
    });
  });

  test("GET /api/health/db should connect to test database", async () => {
    const response = await request(app)
      .get("/api/health/db");

    expect(response.statusCode).toBe(200);

    expect(response.body.success).toBe(true);

    expect(response.body.database.database)
      .toBe("ledgerline_test_db");
  });
});