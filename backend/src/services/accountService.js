const pool = require("../config/db");

// =====================================
// CREATE ACCOUNT
// =====================================

const createAccount = async (userId, accountName, accountType = "customer") => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const accountNumber =
      "LL" + Date.now().toString() + Math.floor(Math.random() * 1000);

    const result = await client.query(
      `INSERT INTO accounts
       (account_number, account_name, account_type, currency)
       VALUES ($1, $2, $3, 'INR')
       RETURNING id, account_number, account_name,
                 account_type, currency, balance_paise, status`,
      [accountNumber, accountName, accountType]
    );

    const account = result.rows[0];

    await client.query(
      `INSERT INTO account_permissions
       (user_id, account_id, can_view, can_deposit,
        can_withdraw, can_transfer)
       VALUES ($1, $2, TRUE, TRUE, TRUE, TRUE)`,
      [userId, account.id]
    );

    await client.query("COMMIT");

    return account;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

// =====================================
// GET USER ACCOUNTS
// =====================================

const getUserAccounts = async (userId) => {
  const result = await pool.query(
    `SELECT
        a.id,
        a.account_number,
        a.account_name,
        a.account_type,
        a.currency,
        a.balance_paise,
        a.status,
        a.created_at
     FROM accounts a
     INNER JOIN account_permissions ap
        ON a.id = ap.account_id
     WHERE ap.user_id = $1
       AND ap.can_view = TRUE
     ORDER BY a.created_at DESC`,
    [userId]
  );

  return result.rows;
};

// =====================================
// GET ACCOUNT BY ID
// =====================================

const getAccountById = async (userId, accountId) => {
  const result = await pool.query(
    `SELECT
        a.id,
        a.account_number,
        a.account_name,
        a.account_type,
        a.currency,
        a.balance_paise,
        a.status,
        a.created_at
     FROM accounts a
     INNER JOIN account_permissions ap
        ON a.id = ap.account_id
     WHERE a.id = $1
       AND ap.user_id = $2
       AND ap.can_view = TRUE`,
    [accountId, userId]
  );

  return result.rows[0] || null;
};

// =====================================
// GET ACCOUNT BALANCE
// =====================================

const getAccountBalance = async (userId, accountId) => {
  const result = await pool.query(
    `SELECT
        a.id,
        a.account_number,
        a.balance_paise,
        a.currency
     FROM accounts a
     INNER JOIN account_permissions ap
        ON a.id = ap.account_id
     WHERE a.id = $1
       AND ap.user_id = $2
       AND ap.can_view = TRUE`,
    [accountId, userId]
  );

  return result.rows[0] || null;
};

// =====================================
// EXPORT SERVICES
// =====================================

module.exports = {
  createAccount,
  getUserAccounts,
  getAccountById,
  getAccountBalance,
};