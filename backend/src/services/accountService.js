
const pool = require("../config/db");
const crypto = require("crypto");

// =====================================
// HELPERS
// =====================================

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const formatRupees = (paise) => {
  const value = BigInt(paise);
  const rupees = value / 100n;
  const remainder = (value % 100n).toString().padStart(2, "0");

  return `${rupees}.${remainder}`;
};

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
// DEPOSIT MONEY
// DOUBLE-ENTRY ACCOUNTING
// =====================================

const depositMoney = async (
  userId,
  accountId,
  amountPaise,
  idempotencyKey
) => {
  const client = await pool.connect();

  const requestHash = crypto
    .createHash("sha256")
    .update(`deposit:${accountId}:${amountPaise}`)
    .digest("hex");

  try {
    await client.query("BEGIN");

    // ---------------------------------
    // 1. CHECK IDEMPOTENCY
    // ---------------------------------

    const keyResult = await client.query(
      `INSERT INTO idempotency_keys
       (user_id, idempotency_key, request_hash, status)
       VALUES ($1, $2, $3, 'processing')
       ON CONFLICT (user_id, idempotency_key)
       DO NOTHING
       RETURNING id`,
      [userId, idempotencyKey, requestHash]
    );

    if (keyResult.rowCount === 0) {
      const existingResult = await client.query(
        `SELECT request_hash, status, response_body
         FROM idempotency_keys
         WHERE user_id = $1
           AND idempotency_key = $2
         FOR UPDATE`,
        [userId, idempotencyKey]
      );

      const existing = existingResult.rows[0];

      if (existing.request_hash !== requestHash) {
        throw createError(
          "Idempotency key already used with different request data",
          409
        );
      }

      if (existing.status === "completed") {
        await client.query("COMMIT");

        return {
          ...existing.response_body,
          replayed: true,
        };
      }

      throw createError(
        "This request is already being processed",
        409
      );
    }

    // ---------------------------------
    // 2. VERIFY CUSTOMER ACCOUNT
    // ---------------------------------

    const accountResult = await client.query(
      `SELECT
          a.id,
          a.account_number,
          a.account_name,
          a.balance_paise,
          a.currency,
          a.status,
          ap.can_deposit
       FROM accounts a
       INNER JOIN account_permissions ap
          ON a.id = ap.account_id
       WHERE a.id = $1
         AND ap.user_id = $2
       FOR UPDATE OF a`,
      [accountId, userId]
    );

    if (accountResult.rowCount === 0) {
      throw createError("Account not found or access denied", 404);
    }

    const account = accountResult.rows[0];

    if (!account.can_deposit) {
      throw createError(
        "You do not have deposit permission",
        403
      );
    }

    if (account.status !== "active") {
      throw createError("Account is not active", 409);
    }

    if (account.currency !== "INR") {
      throw createError("Only INR deposits are supported", 400);
    }

    // ---------------------------------
    // 3. GET OR CREATE SYSTEM ACCOUNT
    // ---------------------------------

    const systemAccountNumber = "LL-SYSTEM-INR-DEPOSIT";

    await client.query(
      `INSERT INTO accounts
       (account_number, account_name, account_type, currency)
       VALUES ($1, $2, 'system', 'INR')
       ON CONFLICT (account_number) DO NOTHING`,
      [
        systemAccountNumber,
        "LedgerLine Deposit Clearing"
      ]
    );

    const systemResult = await client.query(
      `SELECT id, balance_paise, status
       FROM accounts
       WHERE account_number = $1
       FOR UPDATE`,
      [systemAccountNumber]
    );

    const systemAccount = systemResult.rows[0];

    if (!systemAccount || systemAccount.status !== "active") {
      throw createError("System account unavailable", 500);
    }

    // ---------------------------------
    // 4. CREATE TRANSACTION
    // ---------------------------------

    const transactionResult = await client.query(
      `INSERT INTO transactions
       (
         transaction_type,
         status,
         initiated_by,
         description,
         metadata
       )
       VALUES
       (
         'deposit',
         'pending',
         $1,
         $2,
         $3::jsonb
       )
       RETURNING id, created_at`,
      [
        userId,
        `Deposit to account ${account.account_number}`,
        JSON.stringify({
          amount_paise: amountPaise,
          currency: "INR",
          account_id: accountId
        })
      ]
    );

    const transaction = transactionResult.rows[0];

    // ---------------------------------
    // 5. CREATE DEBIT ENTRY
    // SYSTEM ACCOUNT
    // ---------------------------------

    await client.query(
      `INSERT INTO ledger_entries
       (
         transaction_id,
         account_id,
         entry_side,
         amount_paise
       )
       VALUES ($1, $2, 'debit', $3)`,
      [
        transaction.id,
        systemAccount.id,
        amountPaise
      ]
    );

    // ---------------------------------
    // 6. CREATE CREDIT ENTRY
    // CUSTOMER ACCOUNT
    // ---------------------------------

    await client.query(
      `INSERT INTO ledger_entries
       (
         transaction_id,
         account_id,
         entry_side,
         amount_paise
       )
       VALUES ($1, $2, 'credit', $3)`,
      [
        transaction.id,
        accountId,
        amountPaise
      ]
    );

    // ---------------------------------
    // 7. UPDATE ACCOUNT BALANCES
    // ---------------------------------

    await client.query(
      `UPDATE accounts
       SET balance_paise = balance_paise + $1
       WHERE id = $2`,
      [amountPaise, accountId]
    );

    await client.query(
      `UPDATE accounts
       SET balance_paise = balance_paise - $1
       WHERE id = $2`,
      [amountPaise, systemAccount.id]
    );

    // ---------------------------------
    // 8. POST TRANSACTION
    // ---------------------------------

    await client.query(
      `UPDATE transactions
       SET status = 'posted',
           completed_at = NOW()
       WHERE id = $1`,
      [transaction.id]
    );

    // ---------------------------------
    // 9. AUDIT LOG
    // ---------------------------------

    await client.query(
      `INSERT INTO audit_logs
       (
         actor_id,
         action,
         resource_type,
         resource_id,
         outcome,
         metadata
       )
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
      [
        userId,
        "DEPOSIT",
        "transaction",
        transaction.id,
        "success",
        JSON.stringify({
          account_id: accountId,
          amount_paise: amountPaise
        })
      ]
    );

    // ---------------------------------
    // 10. TRANSACTION ATTEMPT LOG
    // ---------------------------------

    await client.query(
      `INSERT INTO transaction_attempts
       (
         actor_id,
         operation,
         target_account_id,
         amount_paise,
         idempotency_key,
         outcome,
         reason
       )
       VALUES ($1, 'deposit', $2, $3, $4, 'success', $5)`,
      [
        userId,
        accountId,
        amountPaise,
        idempotencyKey,
        "Deposit completed successfully"
      ]
    );

    // ---------------------------------
    // 11. PREPARE RESPONSE
    // ---------------------------------

    const balanceResult = await client.query(
      `SELECT balance_paise
       FROM accounts
       WHERE id = $1`,
      [accountId]
    );

    const response = {
      success: true,
      message: "Deposit completed successfully",
      transaction: {
        id: transaction.id,
        type: "deposit",
        status: "posted",
        amount_paise: String(amountPaise),
        amount_rupees: formatRupees(amountPaise),
        created_at: transaction.created_at
      },
      account: {
        id: accountId,
        account_number: account.account_number,
        balance_paise: balanceResult.rows[0].balance_paise,
        balance_rupees: formatRupees(
          balanceResult.rows[0].balance_paise
        ),
        currency: "INR"
      },
      replayed: false
    };

    // ---------------------------------
    // 12. COMPLETE IDEMPOTENCY RECORD
    // ---------------------------------

    await client.query(
      `UPDATE idempotency_keys
       SET transaction_id = $1,
           status = 'completed',
           response_body = $2::jsonb,
           completed_at = NOW()
       WHERE user_id = $3
         AND idempotency_key = $4`,
      [
        transaction.id,
        JSON.stringify(response),
        userId,
        idempotencyKey
      ]
    );

    // ---------------------------------
    // 13. COMMIT
    // ---------------------------------

    await client.query("COMMIT");

    return response;

  } catch (error) {
    await client.query("ROLLBACK");

    // Record failed attempt separately.
    try {
      await pool.query(
        `INSERT INTO transaction_attempts
         (
           actor_id,
           operation,
           target_account_id,
           amount_paise,
           idempotency_key,
           outcome,
           reason
         )
         VALUES ($1, 'deposit', $2, $3, $4, 'failed', $5)`,
        [
          userId,
          accountId,
          amountPaise,
          idempotencyKey,
          error.message.substring(0, 1000)
        ]
      );
    } catch (logError) {
      console.error("Failed attempt logging error:", logError.message);
    }

    throw error;

  } finally {
    client.release();
  }
};

// =====================================
// EXPORT SERVICES
// =====================================

// =====================================
// WITHDRAW MONEY
// DOUBLE-ENTRY ACCOUNTING
// =====================================

const withdrawMoney = async (
  userId,
  accountId,
  amountPaise,
  idempotencyKey
) => {
  const client = await pool.connect();

  const requestHash = crypto
    .createHash("sha256")
    .update(`withdrawal:${accountId}:${amountPaise}`)
    .digest("hex");

  let transactionStarted = false;

  try {
    await client.query("BEGIN");
    transactionStarted = true;

    // ---------------------------------
    // 1. CHECK IDEMPOTENCY
    // ---------------------------------

    const keyResult = await client.query(
      `INSERT INTO idempotency_keys
       (user_id, idempotency_key, request_hash, status)
       VALUES ($1, $2, $3, 'processing')
       ON CONFLICT (user_id, idempotency_key)
       DO NOTHING
       RETURNING id`,
      [userId, idempotencyKey, requestHash]
    );

    if (keyResult.rowCount === 0) {
      const existingResult = await client.query(
        `SELECT request_hash, status, response_body
         FROM idempotency_keys
         WHERE user_id = $1
           AND idempotency_key = $2
         FOR UPDATE`,
        [userId, idempotencyKey]
      );

      const existing = existingResult.rows[0];

      if (existing.request_hash !== requestHash) {
        throw createError(
          "Idempotency key already used with different request data",
          409
        );
      }

      if (existing.status === "completed") {
        await client.query("COMMIT");
        transactionStarted = false;

        return {
          ...existing.response_body,
          replayed: true
        };
      }

      throw createError(
        "This request is already being processed",
        409
      );
    }

    // ---------------------------------
    // 2. VERIFY CUSTOMER ACCOUNT
    // ---------------------------------

    const accountResult = await client.query(
      `SELECT
          a.id,
          a.account_number,
          a.account_name,
          a.account_type,
          a.balance_paise,
          a.currency,
          a.status,
          ap.can_withdraw
       FROM accounts a
       INNER JOIN account_permissions ap
          ON a.id = ap.account_id
       WHERE a.id = $1
         AND ap.user_id = $2
       FOR UPDATE OF a`,
      [accountId, userId]
    );

    if (accountResult.rowCount === 0) {
      throw createError(
        "Account not found or access denied",
        404
      );
    }

    const account = accountResult.rows[0];

    if (account.account_type !== "customer") {
      throw createError(
        "Withdrawals are allowed only from customer accounts",
        403
      );
    }

    if (!account.can_withdraw) {
      throw createError(
        "You do not have withdrawal permission",
        403
      );
    }

    if (account.status !== "active") {
      throw createError(
        "Account is not active",
        409
      );
    }

    if (account.currency !== "INR") {
      throw createError(
        "Only INR withdrawals are supported",
        400
      );
    }

    // ---------------------------------
    // 3. CHECK AVAILABLE BALANCE
    // ---------------------------------

    const currentBalance = BigInt(account.balance_paise);
    const withdrawalAmount = BigInt(amountPaise);

    if (currentBalance < withdrawalAmount) {
      throw createError(
        "Insufficient account balance",
        409
      );
    }

    // ---------------------------------
    // 4. GET OR CREATE SYSTEM ACCOUNT
    // ---------------------------------

    const systemAccountNumber = "LL-SYSTEM-INR-WITHDRAWAL";

    await client.query(
      `INSERT INTO accounts
       (account_number, account_name, account_type, currency)
       VALUES ($1, $2, 'system', 'INR')
       ON CONFLICT (account_number) DO NOTHING`,
      [
        systemAccountNumber,
        "LedgerLine Withdrawal Clearing"
      ]
    );

    const systemResult = await client.query(
      `SELECT id, balance_paise, status
       FROM accounts
       WHERE account_number = $1
       FOR UPDATE`,
      [systemAccountNumber]
    );

    const systemAccount = systemResult.rows[0];

    if (!systemAccount || systemAccount.status !== "active") {
      throw createError(
        "System account unavailable",
        500
      );
    }

    // ---------------------------------
    // 5. CREATE TRANSACTION
    // ---------------------------------

    const transactionResult = await client.query(
      `INSERT INTO transactions
       (
         transaction_type,
         status,
         initiated_by,
         description,
         metadata
       )
       VALUES
       (
         'withdrawal',
         'pending',
         $1,
         $2,
         $3::jsonb
       )
       RETURNING id, created_at`,
      [
        userId,
        `Withdrawal from account ${account.account_number}`,
        JSON.stringify({
          amount_paise: amountPaise,
          currency: "INR",
          account_id: accountId
        })
      ]
    );

    const transaction = transactionResult.rows[0];

    // ---------------------------------
    // 6. CUSTOMER DEBIT ENTRY
    // ---------------------------------

    await client.query(
      `INSERT INTO ledger_entries
       (
         transaction_id,
         account_id,
         entry_side,
         amount_paise
       )
       VALUES ($1, $2, 'debit', $3)`,
      [
        transaction.id,
        accountId,
        amountPaise
      ]
    );

    // ---------------------------------
    // 7. SYSTEM CREDIT ENTRY
    // ---------------------------------

    await client.query(
      `INSERT INTO ledger_entries
       (
         transaction_id,
         account_id,
         entry_side,
         amount_paise
       )
       VALUES ($1, $2, 'credit', $3)`,
      [
        transaction.id,
        systemAccount.id,
        amountPaise
      ]
    );

    // ---------------------------------
    // 8. UPDATE ACCOUNT BALANCES
    // ---------------------------------

    await client.query(
      `UPDATE accounts
       SET balance_paise = balance_paise - $1
       WHERE id = $2`,
      [amountPaise, accountId]
    );

    await client.query(
      `UPDATE accounts
       SET balance_paise = balance_paise + $1
       WHERE id = $2`,
      [amountPaise, systemAccount.id]
    );

    // ---------------------------------
    // 9. POST TRANSACTION
    // ---------------------------------

    await client.query(
      `UPDATE transactions
       SET status = 'posted',
           completed_at = NOW()
       WHERE id = $1`,
      [transaction.id]
    );

    // ---------------------------------
    // 10. AUDIT LOG
    // ---------------------------------

    await client.query(
      `INSERT INTO audit_logs
       (
         actor_id,
         action,
         resource_type,
         resource_id,
         outcome,
         metadata
       )
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
      [
        userId,
        "WITHDRAWAL",
        "transaction",
        transaction.id,
        "success",
        JSON.stringify({
          account_id: accountId,
          amount_paise: amountPaise
        })
      ]
    );

    // ---------------------------------
    // 11. TRANSACTION ATTEMPT LOG
    // ---------------------------------

    await client.query(
      `INSERT INTO transaction_attempts
       (
         actor_id,
         operation,
         source_account_id,
         amount_paise,
         idempotency_key,
         outcome,
         reason
       )
       VALUES ($1, 'withdrawal', $2, $3, $4, 'success', $5)`,
      [
        userId,
        accountId,
        amountPaise,
        idempotencyKey,
        "Withdrawal completed successfully"
      ]
    );

    // ---------------------------------
    // 12. GET UPDATED BALANCE
    // ---------------------------------

    const balanceResult = await client.query(
      `SELECT balance_paise
       FROM accounts
       WHERE id = $1`,
      [accountId]
    );

    const updatedBalance = balanceResult.rows[0].balance_paise;

    // ---------------------------------
    // 13. PREPARE RESPONSE
    // ---------------------------------

    const response = {
      success: true,
      message: "Withdrawal completed successfully",

      transaction: {
        id: transaction.id,
        type: "withdrawal",
        status: "posted",
        amount_paise: String(amountPaise),
        amount_rupees: formatRupees(amountPaise),
        created_at: transaction.created_at
      },

      account: {
        id: accountId,
        account_number: account.account_number,
        balance_paise: updatedBalance,
        balance_rupees: formatRupees(updatedBalance),
        currency: "INR"
      },

      replayed: false
    };

    // ---------------------------------
    // 14. COMPLETE IDEMPOTENCY RECORD
    // ---------------------------------

    await client.query(
      `UPDATE idempotency_keys
       SET transaction_id = $1,
           status = 'completed',
           response_body = $2::jsonb,
           completed_at = NOW()
       WHERE user_id = $3
         AND idempotency_key = $4`,
      [
        transaction.id,
        JSON.stringify(response),
        userId,
        idempotencyKey
      ]
    );

    // ---------------------------------
    // 15. COMMIT
    // ---------------------------------

    await client.query("COMMIT");
    transactionStarted = false;

    return response;

  } catch (error) {

    if (transactionStarted) {
      await client.query("ROLLBACK");
      transactionStarted = false;
    }

    // Record failed withdrawal attempt separately
    try {
      await pool.query(
        `INSERT INTO transaction_attempts
         (
           actor_id,
           operation,
           source_account_id,
           amount_paise,
           idempotency_key,
           outcome,
           reason
         )
         VALUES ($1, 'withdrawal', $2, $3, $4, $5, $6)`,
        [
          userId,
          accountId,
          amountPaise,
          idempotencyKey,
          error.statusCode && error.statusCode < 500
            ? "rejected"
            : "failed",
          error.message.substring(0, 1000)
        ]
      );
    } catch (logError) {
      console.error(
        "Withdrawal attempt logging error:",
        logError.message
      );
    }

    throw error;

  } finally {
    client.release();
  }
};

module.exports = {
  createAccount,
  getUserAccounts,
  getAccountById,
  getAccountBalance,
  depositMoney,
  withdrawMoney
};