
const express = require("express");

const router = express.Router();

const authenticateToken = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const {
  getAllUsers,
  updateUserStatus,
  getAccountPermissions,
  updateAccountPermissions,
} = require("../controllers/adminController");

// All admin routes require authentication and admin role.
router.use(authenticateToken);
router.use(authorizeRoles("admin"));

// User management.
router.get("/users", getAllUsers);

router.patch("/users/:userId/status", updateUserStatus);

// Account permission management.
router.get(
  "/accounts/:accountId/permissions",
  getAccountPermissions
);

router.put(
  "/accounts/:accountId/permissions/:userId",
  updateAccountPermissions
);

module.exports = router;
