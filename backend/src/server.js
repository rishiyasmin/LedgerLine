
const app = require("./app");
const pool = require("./config/db");

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

async function shutdown() {
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
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
