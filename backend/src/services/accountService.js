
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
// =====================================
// TRANSFER MONEY
// DOUBLE-ENTRY ACCOUNTING
// =====================================

const transferMoney = async (
  userId,
  sourceAccountId,
  targetAccountId,
  amountPaise,
  idempotencyKey
) => {
  const client = await pool.connect();

  const requestHash = crypto
    .createHash("sha256")
    .update(
      `transfer:${sourceAccountId}:${targetAccountId}:${amountPaise}`
    )
    .digest("hex");

  let transactionStarted = false;

  try {
    await client.query("BEGIN");
    transactionStarted = true;

    // 1. CHECK IDEMPOTENCY

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

    // 2. VALIDATE SOURCE AND TARGET ACCOUNTS

    if (sourceAccountId === targetAccountId) {
      throw createError(
        "Source and destination accounts must be different",
        400
      );
    }

    // Lock both accounts in a consistent order to reduce deadlocks.
    const accountsResult = await client.query(
      `SELECT
         id,
         account_number,
         account_name,
         account_type,
         balance_paise,
         currency,
         status
       FROM accounts
       WHERE id = ANY($1::uuid[])
       ORDER BY id
       FOR UPDATE`,
      [[sourceAccountId, targetAccountId]]
    );

    if (accountsResult.rowCount !== 2) {
      throw createError("Source or destination account not found", 404);
    }

    const sourceAccount = accountsResult.rows.find(
      account => account.id === sourceAccountId
    );

    const targetAccount = accountsResult.rows.find(
      account => account.id === targetAccountId
    );

    if (
      sourceAccount.account_type !== "customer" ||
      targetAccount.account_type !== "customer"
    ) {
      throw createError(
        "Transfers are allowed only between customer accounts",
        403
      );
    }

    // 3. CHECK SOURCE ACCOUNT PERMISSION

    const permissionResult = await client.query(
      `SELECT can_transfer
       FROM account_permissions
       WHERE user_id = $1
         AND account_id = $2`,
      [userId, sourceAccountId]
    );

    if (
      permissionResult.rowCount === 0 ||
      !permissionResult.rows[0].can_transfer
    ) {
      throw createError(
        "You do not have permission to transfer from this account",
        403
      );
    }

    // 4. CHECK ACCOUNT STATUS AND CURRENCY

    if (
      sourceAccount.status !== "active" ||
      targetAccount.status !== "active"
    ) {
      throw createError(
        "Both accounts must be active",
        409
      );
    }

    if (
      sourceAccount.currency !== "INR" ||
      targetAccount.currency !== "INR"
    ) {
      throw createError(
        "Only INR transfers are supported",
        400
      );
    }

    // 5. CHECK SOURCE BALANCE

    const currentBalance = BigInt(sourceAccount.balance_paise);
    const transferAmount = BigInt(amountPaise);

    if (transferAmount <= 0n) {
      throw createError("Transfer amount must be greater than zero", 400);
    }

    if (currentBalance < transferAmount) {
      throw createError("Insufficient account balance", 409);
    }

    // 6. CREATE TRANSACTION

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
         'transfer',
         'pending',
         $1,
         $2,
         $3::jsonb
       )
       RETURNING id, created_at`,
      [
        userId,
        `Transfer from ${sourceAccount.account_number} to ${targetAccount.account_number}`,
        JSON.stringify({
          amount_paise: String(amountPaise),
          currency: "INR",
          source_account_id: sourceAccountId,
          target_account_id: targetAccountId
        })
      ]
    );

    const transaction = transactionResult.rows[0];

    // 7. DEBIT SOURCE ACCOUNT

    await client.query(
      `INSERT INTO ledger_entries
       (transaction_id, account_id, entry_side, amount_paise)
       VALUES ($1, $2, 'debit', $3)`,
      [transaction.id, sourceAccountId, amountPaise]
    );

    // 8. CREDIT DESTINATION ACCOUNT

    await client.query(
      `INSERT INTO ledger_entries
       (transaction_id, account_id, entry_side, amount_paise)
       VALUES ($1, $2, 'credit', $3)`,
      [transaction.id, targetAccountId, amountPaise]
    );

    // 9. UPDATE BOTH ACCOUNT BALANCES

    await client.query(
      `UPDATE accounts
       SET balance_paise = balance_paise - $1
       WHERE id = $2`,
      [amountPaise, sourceAccountId]
    );

    await client.query(
      `UPDATE accounts
       SET balance_paise = balance_paise + $1
       WHERE id = $2`,
      [amountPaise, targetAccountId]
    );

    // 10. POST TRANSACTION

    await client.query(
      `UPDATE transactions
       SET status = 'posted',
           completed_at = NOW()
       WHERE id = $1`,
      [transaction.id]
    );

    // 11. INSERT AUDIT LOG

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
        "TRANSFER",
        "transaction",
        transaction.id,
        "success",
        JSON.stringify({
          source_account_id: sourceAccountId,
          target_account_id: targetAccountId,
          amount_paise: String(amountPaise)
        })
      ]
    );

    // 12. INSERT TRANSACTION ATTEMPT

    await client.query(
      `INSERT INTO transaction_attempts
       (
         actor_id,
         operation,
         source_account_id,
         target_account_id,
         amount_paise,
         idempotency_key,
         outcome,
         reason
       )
       VALUES ($1, 'transfer', $2, $3, $4, $5, 'success', $6)`,
      [
        userId,
        sourceAccountId,
        targetAccountId,
        amountPaise,
        idempotencyKey,
        "Transfer completed successfully"
      ]
    );

    // 13. GET UPDATED BALANCES

    const balancesResult = await client.query(
      `SELECT id, balance_paise
       FROM accounts
       WHERE id = ANY($1::uuid[])`,
      [[sourceAccountId, targetAccountId]]
    );

    const sourceBalance = balancesResult.rows.find(
      account => account.id === sourceAccountId
    ).balance_paise;

    const targetBalance = balancesResult.rows.find(
      account => account.id === targetAccountId
    ).balance_paise;

    // 14. PREPARE RESPONSE

    const response = {
      success: true,
      message: "Transfer completed successfully",

      transaction: {
        id: transaction.id,
        type: "transfer",
        status: "posted",
        amount_paise: String(amountPaise),
        amount_rupees: formatRupees(amountPaise),
        created_at: transaction.created_at
      },

      source_account: {
        id: sourceAccountId,
        account_number: sourceAccount.account_number,
        balance_paise: sourceBalance,
        balance_rupees: formatRupees(sourceBalance)
      },

      target_account: {
        id: targetAccountId,
        account_number: targetAccount.account_number,
        balance_paise: targetBalance,
        balance_rupees: formatRupees(targetBalance)
      },

      currency: "INR",
      replayed: false
    };

    // 15. COMPLETE IDEMPOTENCY RECORD

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

    // 16. COMMIT

    await client.query("COMMIT");
    transactionStarted = false;

    return response;

  } catch (error) {
    if (transactionStarted) {
      await client.query("ROLLBACK");
      transactionStarted = false;
    }

    // Record failed or rejected transfer attempt.
    try {
      await pool.query(
        `INSERT INTO transaction_attempts
         (
           actor_id,
           operation,
           source_account_id,
           target_account_id,
           amount_paise,
           idempotency_key,
           outcome,
           reason
         )
         VALUES ($1, 'transfer', $2, $3, $4, $5, $6, $7)`,
        [
          userId,
          sourceAccountId,
          targetAccountId,
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
        "Transfer attempt logging error:",
        logError.message
      );
    }

    throw error;

  } finally {
    client.release();
  }
};

// =====================================
// GET ACCOUNT TRANSACTION HISTORY
// =====================================


const getAccountTransactions = async (userId, accountId) => {
  // 1. Verify that the user can view this account
  const accessResult = await pool.query(
    `SELECT id
     FROM account_permissions
     WHERE user_id = $1
       AND account_id = $2
       AND can_view = TRUE`,
    [userId, accountId]
  );

  if (accessResult.rowCount === 0) {
    throw createError("Account not found or access denied", 404);
  }

  // 2. Fetch successful ledger entries and their initiators
  const ledgerResult = await pool.query(
    `SELECT
       t.id AS transaction_id,
       t.transaction_type,
       t.status,
       t.description,
       t.created_at,
       le.entry_side,
       le.amount_paise,
       t.metadata,
       u.id AS initiated_by,
       u.full_name AS initiated_by_name
     FROM ledger_entries le
     INNER JOIN transactions t
       ON t.id = le.transaction_id
     LEFT JOIN users u
       ON u.id = t.initiated_by
     WHERE le.account_id = $1`,
    [accountId]
  );

  // 3. Fetch rejected and failed attempts involving this account
  const attemptsResult = await pool.query(
    `SELECT
       ta.id AS attempt_id,
       ta.operation,
       ta.outcome,
       ta.reason,
       ta.amount_paise,
       ta.created_at,
       u.id AS initiated_by,
       u.full_name AS initiated_by_name
     FROM transaction_attempts ta
     LEFT JOIN users u
       ON u.id = ta.actor_id
     WHERE
       (ta.source_account_id = $1 OR ta.target_account_id = $1)
       AND ta.outcome IN ('rejected', 'failed')`,
    [accountId]
  );

  // 4. Combine ledger entries and unsuccessful attempts
  const events = [
    ...ledgerResult.rows.map(row => ({
      record_type: "ledger_entry",
      timestamp: row.created_at,
      transaction_id: row.transaction_id,
      type: row.transaction_type,
      status: row.status,
      description: row.description,
      entry_side: row.entry_side,
      amount_paise: String(row.amount_paise),
      initiated_by: row.initiated_by,
      initiated_by_name: row.initiated_by_name,
      metadata: row.metadata,
      delta: row.entry_side === "credit"
        ? BigInt(row.amount_paise)
        : -BigInt(row.amount_paise)
    })),

    ...attemptsResult.rows.map(row => ({
      record_type: "transaction_attempt",
      timestamp: row.created_at,
      attempt_id: row.attempt_id,
      type: row.operation,
      status: row.outcome,
      description: row.reason,
      entry_side: null,
      amount_paise: row.amount_paise == null
        ? null
        : String(row.amount_paise),
      initiated_by: row.initiated_by,
      initiated_by_name: row.initiated_by_name,
      metadata: null,
      delta: 0n
    }))
  ];

  // 5. Sort events chronologically
  events.sort((a, b) => {
    const timeDifference =
      new Date(a.timestamp).getTime() -
      new Date(b.timestamp).getTime();

    if (timeDifference !== 0) {
      return timeDifference;
    }

    // Show an attempt before a ledger entry if timestamps match
    if (a.record_type !== b.record_type) {
      return a.record_type === "transaction_attempt" ? -1 : 1;
    }

    return String(a.transaction_id || a.attempt_id)
      .localeCompare(String(b.transaction_id || b.attempt_id));
  });

  // 6. Calculate running balance
  let runningBalance = 0n;

  return events.map(event => {
    runningBalance += event.delta;

    const {
      delta,
      ...publicEvent
    } = event;

    return {
      ...publicEvent,
      amount_rupees: event.amount_paise === null
        ? null
        : formatRupees(event.amount_paise),
      running_balance_paise: String(runningBalance),
      running_balance_rupees: formatRupees(runningBalance)
    };
  });
};

module.exports = {
  createAccount,
  getUserAccounts,
  getAccountById,
  getAccountBalance,
  depositMoney,
  withdrawMoney,
  transferMoney,
  getAccountTransactions
};