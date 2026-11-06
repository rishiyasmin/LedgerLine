require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const pool = require("./config/db");

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "LedgerLine API is running",
  });
});

app.get("/api/health/db", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT current_database() AS database, current_user AS user"
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

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`LedgerLine API running on port ${PORT}`);
});