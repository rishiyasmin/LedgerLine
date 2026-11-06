const express = require("express");

const router = express.Router();

const authenticateToken = require("../middleware/authMiddleware");

const {
  createAccount,
  getUserAccounts,
  getAccountById,
  getAccountBalance,
} = require("../controllers/accountController");

// All account routes require authentication
router.use(authenticateToken);

// Create account
router.post("/", createAccount);

// Get all accounts belonging to logged-in user
router.get("/", getUserAccounts);

// Get account details
router.get("/:accountId", getAccountById);

// Get account balance
router.get("/:accountId/balance", getAccountBalance);

module.exports = router;