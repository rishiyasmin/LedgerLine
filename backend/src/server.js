
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const pool = require("./config/db");

// Routes
const authRoutes = require("./routes/authRoutes");
const accountRoutes = require("./routes/accountRoutes");

// Middleware
const authenticateToken = require("./middleware/authMiddleware");

const app = express();

// =====================================
// GLOBAL MIDDLEWARE
// =====================================

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
      `SELECT
        current_database() AS database,
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
// AUTHENTICATION ROUTES
// =====================================

app.use("/api/auth", authRoutes);

// =====================================
// ACCOUNT MANAGEMENT ROUTES
// =====================================

app.use("/api/accounts", accountRoutes);

// =====================================
// GENERAL PROTECTED ROUTE
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

// =====================================
// START SERVER
// =====================================

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log("----------------------------------");
  console.log("       LEDGERLINE BACKEND");
  console.log("----------------------------------");
  console.log(`Server running on port ${PORT}`);
  console.log(`Health: http://localhost:${PORT}/api/health`);
  console.log(`Database: http://localhost:${PORT}/api/health/db`);
  console.log(`Auth: http://localhost:${PORT}/api/auth`);
  console.log(`Accounts: http://localhost:${PORT}/api/accounts`);
  console.log(`Protected: http://localhost:${PORT}/api/protected`);
  console.log("----------------------------------");
});

// =====================================
// GRACEFUL SHUTDOWN
// =====================================

process.on("SIGINT", () => {
  console.log("Shutting down LedgerLine...");

  server.close(async () => {
    try {
      await pool.end();
      console.log("Database pool closed.");
      process.exit(0);
    } catch (error) {
      console.error("Shutdown error:", error.message);
      process.exit(1);
    }
  });
});