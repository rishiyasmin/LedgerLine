
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const pool = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const accountRoutes = require("./routes/accountRoutes");
const adminRoutes = require("./routes/adminRoutes");

const authenticateToken = require("./middleware/authMiddleware");

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

// =====================================
// HEALTH CHECK
// =====================================

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "LedgerLine API is running",
  });
});

// =====================================
// DATABASE HEALTH CHECK
// =====================================

app.get("/api/health/db", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT current_database() AS database,
              current_user AS username`
    );

    res.status(200).json({
      success: true,
      message: "Database connected successfully",
      database: result.rows[0],
    });
  } catch (error) {
    console.error("Database health check failed:", error.message);

    res.status(503).json({
      success: false,
      message: "Database connection unavailable",
    });
  }
});

// =====================================
// API ROUTES
// =====================================

app.use("/api/auth", authRoutes);

app.use("/api/accounts", accountRoutes);

app.use("/api/admin", adminRoutes);

// =====================================
// PROTECTED ROUTE
// =====================================

app.get("/api/protected", authenticateToken, (req, res) => {
  res.status(200).json({
    success: true,
    message: "You have accessed a protected route",
    user: req.user,
  });
});

// =====================================
// 404 HANDLER
// =====================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found",
  });
});

// =====================================
// GLOBAL ERROR HANDLER
// =====================================

app.use((err, req, res, next) => {
  console.error("Server error:", err);

  if (res.headersSent) {
    return next(err);
  }

  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

module.exports = app;
