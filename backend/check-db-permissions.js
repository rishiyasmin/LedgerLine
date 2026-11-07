
const pool = require("./src/config/db");

async function checkPermissions() {
  try {
    const result = await pool.query(`
      SELECT
        current_database() AS database,
        current_user AS db_user,
        has_table_privilege(current_user, 'users', 'INSERT') AS can_insert_users,
        has_table_privilege(current_user, 'accounts', 'INSERT') AS can_insert_accounts,
        has_table_privilege(current_user, 'account_permissions', 'INSERT') AS can_insert_permissions
    `);

    console.log(result.rows[0]);
  } catch (error) {
    console.error("Database check failed:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

checkPermissions();
