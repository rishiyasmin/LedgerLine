
const express = require("express");

const router = express.Router();

const authenticateToken = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const {
  createAccount,
  getUserAccounts,
  getAccountById,
  getAccountBalance,
  depositMoney,
  withdrawMoney,
  transferMoney,
  getAccountTransactions
} = require("../controllers/accountController");

// All account routes require authentication.
router.use(authenticateToken);

// Create account: account holders only.
router.post(
  "/",
  authorizeRoles("account_holder"),
  createAccount
);

// View permitted accounts: all roles.
// Account-level permissions are checked by the service.
router.get(
  "/",
  authorizeRoles("admin", "account_holder", "auditor"),
  getUserAccounts
);

// Deposit: account holders only.
router.post(
  "/:accountId/deposits",
  authorizeRoles("account_holder"),
  depositMoney
);

// Withdraw: account holders only.
router.post(
  "/:accountId/withdrawals",
  authorizeRoles("account_holder"),
  withdrawMoney
);
// Transfer money: account holders only.
router.post(
  "/:accountId/transfers",
  authorizeRoles("account_holder"),
  transferMoney
);
// View account balance.
router.get(
  "/:accountId/balance",
  authorizeRoles("admin", "account_holder", "auditor"),
  getAccountBalance
);
// View account transaction history.
router.get(
  "/:accountId/transactions",
  authorizeRoles("admin", "account_holder", "auditor"),
  getAccountTransactions
);
// View account details.
router.get(
  "/:accountId",
  authorizeRoles("admin", "account_holder", "auditor"),
  getAccountById
);

module.exports = router;
