const accountService = require("../services/accountService");

// =====================================
// CREATE ACCOUNT
// =====================================

const createAccount = async (req, res) => {
  try {
    const { account_name } = req.body;

    if (!account_name || !account_name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Account name is required",
      });
    }

    if (account_name.trim().length > 120) {
      return res.status(400).json({
        success: false,
        message: "Account name cannot exceed 120 characters",
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
      account,
    });
  } catch (error) {
    console.error("Create account error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to create account",
    });
  }
};

// =====================================
// GET ALL USER ACCOUNTS
// =====================================

const getUserAccounts = async (req, res) => {
  try {
    const accounts = await accountService.getUserAccounts(req.user.id);

    return res.status(200).json({
      success: true,
      count: accounts.length,
      accounts,
    });
  } catch (error) {
    console.error("Get accounts error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve accounts",
    });
  }
};

// =====================================
// GET ACCOUNT DETAILS
// =====================================

const getAccountById = async (req, res) => {
  try {
    const { accountId } = req.params;

    const account = await accountService.getAccountById(
      req.user.id,
      accountId
    );

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Account not found or access denied",
      });
    }

    return res.status(200).json({
      success: true,
      account,
    });
  } catch (error) {
    console.error("Get account error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve account",
    });
  }
};

// =====================================
// GET ACCOUNT BALANCE
// =====================================

const getAccountBalance = async (req, res) => {
  try {
    const { accountId } = req.params;

    const balance = await accountService.getAccountBalance(
      req.user.id,
      accountId
    );

    if (!balance) {
      return res.status(404).json({
        success: false,
        message: "Account not found or access denied",
      });
    }

    return res.status(200).json({
      success: true,
      balance: {
        ...balance,
        balance_rupees: Number(balance.balance_paise) / 100,
      },
    });
  } catch (error) {
    console.error("Get balance error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve balance",
    });
  }
};

module.exports = {
  createAccount,
  getUserAccounts,
  getAccountById,
  getAccountBalance,
};