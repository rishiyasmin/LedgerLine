
const accountService = require("../services/accountService");

// =====================================
// UUID VALIDATION
// =====================================

const isValidUUID = (value) => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
};

// =====================================
// AMOUNT VALIDATION
// =====================================

const convertAmountToPaise = (amount) => {
  if (
    typeof amount !== "string" ||
    !/^(0|[1-9]\d{0,13})(\.\d{1,2})?$/.test(amount)
  ) {
    return null;
  }

  const [rupees, paise = ""] = amount.split(".");

  const amountPaise =
    BigInt(rupees) * 100n +
    BigInt(paise.padEnd(2, "0") || "0");

  if (
    amountPaise <= 0n ||
    amountPaise > 9000000000000000n
  ) {
    return null;
  }

  return amountPaise.toString();
};

// =====================================
// CREATE ACCOUNT
// =====================================

const createAccount = async (req, res) => {
  try {
    const { account_name } = req.body;

    if (
      typeof account_name !== "string" ||
      !account_name.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Account name is required"
      });
    }

    if (account_name.trim().length > 120) {
      return res.status(400).json({
        success: false,
        message: "Account name cannot exceed 120 characters"
      });
    }

    const account = await accountService.createAccount(
      req.user.id,
      account_name.trim(),
      "customer"
    );

    return res.status(201).json({
      success: true,
      message: "Account created successfully",
      account
    });

  } catch (error) {
    console.error("Create account error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to create account"
    });
  }
};

// =====================================
// GET ALL USER ACCOUNTS
// =====================================

const getUserAccounts = async (req, res) => {
  try {
    const accounts = await accountService.getUserAccounts(
      req.user.id
    );

    return res.status(200).json({
      success: true,
      count: accounts.length,
      accounts
    });

  } catch (error) {
    console.error("Get accounts error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve accounts"
    });
  }
};

// =====================================
// GET ACCOUNT DETAILS
// =====================================

const getAccountById = async (req, res) => {
  try {
    const { accountId } = req.params;

    if (!isValidUUID(accountId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid account ID"
      });
    }

    const account = await accountService.getAccountById(
      req.user.id,
      accountId
    );

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Account not found or access denied"
      });
    }

    return res.status(200).json({
      success: true,
      account
    });

  } catch (error) {
    console.error("Get account error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve account"
    });
  }
};

// =====================================
// GET ACCOUNT BALANCE
// =====================================

const getAccountBalance = async (req, res) => {
  try {
    const { accountId } = req.params;

    if (!isValidUUID(accountId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid account ID"
      });
    }

    const balance = await accountService.getAccountBalance(
      req.user.id,
      accountId
    );

    if (!balance) {
      return res.status(404).json({
        success: false,
        message: "Account not found or access denied"
      });
    }

    return res.status(200).json({
      success: true,
      balance: {
        ...balance,
        balance_rupees: Number(balance.balance_paise) / 100
      }
    });

  } catch (error) {
    console.error("Get balance error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve balance"
    });
  }
};

// =====================================
// DEPOSIT MONEY
// =====================================

const depositMoney = async (req, res) => {
  try {
    const { accountId } = req.params;
    const { amount_rupees } = req.body;

    const idempotencyKey = req.get("Idempotency-Key");

    if (!isValidUUID(accountId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid account ID"
      });
    }

    const amountPaise = convertAmountToPaise(amount_rupees);

    if (!amountPaise) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid deposit amount in rupees"
      });
    }

    if (
      typeof idempotencyKey !== "string" ||
      !idempotencyKey.trim() ||
      idempotencyKey.length > 255
    ) {
      return res.status(400).json({
        success: false,
        message: "A valid Idempotency-Key header is required"
      });
    }

    const result = await accountService.depositMoney(
      req.user.id,
      accountId,
      amountPaise,
      idempotencyKey.trim()
    );

    return res.status(200).json(result);

  } catch (error) {
    console.error("Deposit error:", error.message);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : "Unable to process deposit"
    });
  }
};

// =====================================
// WITHDRAW MONEY
// =====================================

const withdrawMoney = async (req, res) => {
  try {
    const { accountId } = req.params;
    const { amount_rupees } = req.body;

    const idempotencyKey = req.get("Idempotency-Key");

    // Validate account ID
    if (!isValidUUID(accountId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid account ID"
      });
    }

    // Validate withdrawal amount
    const amountPaise = convertAmountToPaise(amount_rupees);

    if (!amountPaise) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid withdrawal amount in rupees"
      });
    }

    // Validate idempotency key
    if (
      typeof idempotencyKey !== "string" ||
      !idempotencyKey.trim() ||
      idempotencyKey.length > 255
    ) {
      return res.status(400).json({
        success: false,
        message: "A valid Idempotency-Key header is required"
      });
    }

    // Process withdrawal
    const result = await accountService.withdrawMoney(
      req.user.id,
      accountId,
      amountPaise,
      idempotencyKey.trim()
    );

    return res.status(200).json(result);

  } catch (error) {
    console.error("Withdrawal error:", error.message);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : "Unable to process withdrawal"
    });
  }
};
// =====================================
// TRANSFER MONEY
// =====================================

const transferMoney = async (req, res) => {
  try {
    const { accountId } = req.params;
    const { target_account_id, amount_rupees } = req.body;

    const idempotencyKey = req.get("Idempotency-Key");

    // Validate source account ID
    if (!isValidUUID(accountId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid source account ID"
      });
    }

    // Validate destination account ID
    if (!isValidUUID(target_account_id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid destination account ID"
      });
    }

    // Validate transfer amount
    const amountPaise = convertAmountToPaise(amount_rupees);

    if (!amountPaise) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid transfer amount in rupees"
      });
    }

    // Validate idempotency key
    if (
      typeof idempotencyKey !== "string" ||
      !idempotencyKey.trim() ||
      idempotencyKey.length > 255
    ) {
      return res.status(400).json({
        success: false,
        message: "A valid Idempotency-Key header is required"
      });
    }

    // Process transfer
    const result = await accountService.transferMoney(
      req.user.id,
      accountId,
      target_account_id,
      amountPaise,
      idempotencyKey.trim()
    );

    return res.status(200).json(result);

  } catch (error) {
    console.error("Transfer error:", error.message);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : "Unable to process transfer"
    });
  }
};
// =====================================
// GET ACCOUNT TRANSACTION HISTORY
// =====================================

const getAccountTransactions = async (req, res) => {
  try {
    const { accountId } = req.params;

    if (!isValidUUID(accountId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid account ID"
      });
    }

    const transactions = await accountService.getAccountTransactions(
      req.user.id,
      accountId
    );

    return res.status(200).json({
      success: true,
      count: transactions.length,
      transactions
    });

  } catch (error) {
    console.error("Transaction history error:", error.message);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : "Unable to retrieve transaction history"
    });
  }
};
// =====================================
// EXPORT CONTROLLERS
// =====================================

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
