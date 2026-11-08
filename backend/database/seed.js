require("dotenv").config();
const pool = require("../src/config/db");
const bcrypt = require("bcrypt");

const demoUsers = [
  {
    fullName: "LedgerLine Demo Admin",
    email: "demo-admin@ledgerline.local",
    role: "admin",
    password: process.env.SEED_ADMIN_PASSWORD,
  },
  {
    fullName: "Demo Customer",
    email: "customer@ledgerline.local",
    role: "account_holder",
    password: process.env.SEED_CUSTOMER_PASSWORD,
  },
  {
    fullName: "Demo Auditor",
    email: "auditor@ledgerline.local",
    role: "auditor",
    password: process.env.SEED_AUDITOR_PASSWORD,
  },
];

async function seed() {
  const client = await pool.connect();

  try {
    for (const user of demoUsers) {
      if (!user.password || user.password.length < 8) {
        throw new Error(
          `Missing or weak seed password for ${user.email}`
        );
      }
    }

    await client.query("BEGIN");

    const userIds = {};

    for (const user of demoUsers) {
      const passwordHash = await bcrypt.hash(user.password, 12);

      // Insert only. Do not update existing users using the restricted app role.
      const result = await client.query(
        `INSERT INTO users (full_name, email, password_hash, role)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (LOWER(email)) DO NOTHING
         RETURNING id`,
        [user.fullName, user.email, passwordHash, user.role]
      );

      let userId;

      if (result.rowCount > 0) {
        userId = result.rows[0].id;
      } else {
        const existing = await client.query(
          `SELECT id, role, is_active
           FROM users
           WHERE LOWER(email) = LOWER($1)`,
          [user.email]
        );

        if (
          existing.rowCount === 0 ||
          existing.rows[0].role !== user.role ||
          !existing.rows[0].is_active
        ) {
          throw new Error(
            `Existing demo user ${user.email} has an unexpected role or inactive status.`
          );
        }

        userId = existing.rows[0].id;
      }

      userIds[user.role] = userId;
    }

    // Create simulated system clearing accounts.
    await client.query(
      `INSERT INTO accounts
       (account_number, account_name, account_type, currency)
       VALUES
       ('LL-SYSTEM-INR-DEPOSIT', 'Deposit Clearing Account', 'system', 'INR'),
       ('LL-SYSTEM-INR-WITHDRAWAL', 'Withdrawal Clearing Account', 'system', 'INR')
       ON CONFLICT (account_number) DO NOTHING`
    );

    // Create or find the demo customer account.
    const accountResult = await client.query(
      `INSERT INTO accounts
       (account_number, account_name, account_type, currency)
       VALUES ($1, $2, 'customer', 'INR')
       ON CONFLICT (account_number) DO NOTHING
       RETURNING id`,
      ["LL-DEMO-CUSTOMER-001", "Demo Customer Account"]
    );

    let customerAccountId;

    if (accountResult.rowCount > 0) {
      customerAccountId = accountResult.rows[0].id;
    } else {
      const existingAccount = await client.query(
        `SELECT id, account_type
         FROM accounts
         WHERE account_number = $1`,
        ["LL-DEMO-CUSTOMER-001"]
      );

      if (
        existingAccount.rowCount === 0 ||
        existingAccount.rows[0].account_type !== "customer"
      ) {
        throw new Error("Existing demo account is invalid.");
      }

      customerAccountId = existingAccount.rows[0].id;
    }

    // Customer permissions. Existing permission rows are left unchanged.
    await client.query(
      `INSERT INTO account_permissions
       (user_id, account_id, can_view, can_deposit,
        can_withdraw, can_transfer, can_adjust, granted_by)
       VALUES ($1, $2, TRUE, TRUE, TRUE, TRUE, FALSE, $3)
       ON CONFLICT (user_id, account_id) DO NOTHING`,
      [userIds.account_holder, customerAccountId, userIds.admin]
    );

    // Auditor receives view-only access.
    await client.query(
      `INSERT INTO account_permissions
       (user_id, account_id, can_view, can_deposit,
        can_withdraw, can_transfer, can_adjust, granted_by)
       VALUES ($1, $2, TRUE, FALSE, FALSE, FALSE, FALSE, $3)
       ON CONFLICT (user_id, account_id) DO NOTHING`,
      [userIds.auditor, customerAccountId, userIds.admin]
    );

    await client.query("COMMIT");

    console.log("LedgerLine demo seed completed successfully.");
    console.log("Admin:", "demo-admin@ledgerline.local");
    console.log("Customer:", "customer@ledgerline.local");
    console.log("Auditor:", "auditor@ledgerline.local");
    console.log("Demo account:", "LL-DEMO-CUSTOMER-001");
    console.log("Customer account ID:", customerAccountId);
    console.log("Initial customer balance: ₹0.00");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Seed failed:", error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
