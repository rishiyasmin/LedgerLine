
const pool = require("../config/db");

const isValidUUID = (value) => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
};

// =====================================
// GET ALL USERS
// =====================================

const getAllUsers = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, full_name, email, role, is_active, created_at
       FROM users
       ORDER BY created_at DESC`
    );

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      users: result.rows,
    });
  } catch (error) {
    console.error("Get users error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve users",
    });
  }
};

// =====================================
// UPDATE USER STATUS
// =====================================

const updateUserStatus = async (req, res) => {
  const { userId } = req.params;
  const { is_active } = req.body;
  const adminId = req.user.id;

  if (!isValidUUID(userId) || typeof is_active !== "boolean") {
    return res.status(400).json({
      success: false,
      message: "Valid user ID and is_active boolean are required",
    });
  }

  if (userId === adminId && is_active === false) {
    return res.status(403).json({
      success: false,
      message: "You cannot deactivate your own admin account",
    });
  }

  let client;

  try {
    client = await pool.connect();
    await client.query("BEGIN");

    const userResult = await client.query(
      `SELECT id, role, is_active
       FROM users
       WHERE id = $1
       FOR UPDATE`,
      [userId]
    );

    if (userResult.rowCount === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const targetUser = userResult.rows[0];

    if (
      targetUser.role === "admin" &&
      targetUser.is_active &&
      is_active === false
    ) {
      const adminCount = await client.query(
        `SELECT COUNT(*) AS count
         FROM users
         WHERE role = 'admin' AND is_active = TRUE`
      );

      if (Number(adminCount.rows[0].count) <= 1) {
        await client.query("ROLLBACK");

        return res.status(409).json({
          success: false,
          message: "Cannot deactivate the last active admin",
        });
      }
    }

    const updateResult = await client.query(
      `UPDATE users
       SET is_active = $1
       WHERE id = $2
       RETURNING id, full_name, email, role, is_active`,
      [is_active, userId]
    );

    await client.query(
      `INSERT INTO audit_logs
       (actor_id, action, resource_type, resource_id, outcome, metadata)
       VALUES ($1, $2, 'user', $3, 'success', $4::jsonb)`,
      [
        adminId,
        is_active ? "ACTIVATE_USER" : "DEACTIVATE_USER",
        userId,
        JSON.stringify({
          previous_status: targetUser.is_active,
          new_status: is_active,
        }),
      ]
    );

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: is_active
        ? "User activated successfully"
        : "User deactivated successfully",
      user: updateResult.rows[0],
    });
  } catch (error) {
    if (client) {
      await client.query("ROLLBACK").catch(() => {});
    }

    console.error("Update user status error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to update user status",
    });
  } finally {
    if (client) client.release();
  }
};

// =====================================
// GET ACCOUNT PERMISSIONS
// =====================================

const getAccountPermissions = async (req, res) => {
  const { accountId } = req.params;

  if (!isValidUUID(accountId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid account ID",
    });
  }

  try {
    const accountResult = await pool.query(
      `SELECT id, account_name, account_type
       FROM accounts
       WHERE id = $1`,
      [accountId]
    );

    if (accountResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Account not found",
      });
    }

    const result = await pool.query(
      `SELECT
         ap.user_id,
         u.full_name,
         u.email,
         u.role,
         u.is_active,
         ap.can_view,
         ap.can_deposit,
         ap.can_withdraw,
         ap.can_transfer,
         ap.can_adjust,
         ap.granted_by,
         ap.created_at
       FROM account_permissions ap
       JOIN users u ON u.id = ap.user_id
       WHERE ap.account_id = $1
       ORDER BY ap.created_at DESC`,
      [accountId]
    );

    return res.status(200).json({
      success: true,
      account: accountResult.rows[0],
      count: result.rows.length,
      permissions: result.rows,
    });
  } catch (error) {
    console.error("Get permissions error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve account permissions",
    });
  }
};

// =====================================
// GRANT / UPDATE ACCOUNT PERMISSIONS
// =====================================

const updateAccountPermissions = async (req, res) => {
  const { accountId, userId } = req.params;
  const adminId = req.user.id;

  const {
    can_view,
    can_deposit,
    can_withdraw,
    can_transfer,
    can_adjust,
  } = req.body;

  if (!isValidUUID(accountId) || !isValidUUID(userId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid account ID or user ID",
    });
  }

  const permissions = {
    can_view,
    can_deposit,
    can_withdraw,
    can_transfer,
    can_adjust,
  };

  if (
    Object.values(permissions).some(
      (value) => typeof value !== "boolean"
    )
  ) {
    return res.status(400).json({
      success: false,
      message: "All five permission fields must be boolean values",
    });
  }

  let client;

  try {
    client = await pool.connect();
    await client.query("BEGIN");

    // Only customer accounts can receive these permissions.
    const accountResult = await client.query(
      `SELECT id
       FROM accounts
       WHERE id = $1 AND account_type = 'customer'
       FOR UPDATE`,
      [accountId]
    );

    if (accountResult.rowCount === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message: "Customer account not found",
      });
    }

    const userResult = await client.query(
      `SELECT id, role, is_active
       FROM users
       WHERE id = $1
       FOR UPDATE`,
      [userId]
    );

    if (userResult.rowCount === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const targetUser = userResult.rows[0];

    if (!targetUser.is_active) {
      await client.query("ROLLBACK");

      return res.status(409).json({
        success: false,
        message: "Cannot grant permissions to an inactive user",
      });
    }

    if (!["account_holder", "auditor"].includes(targetUser.role)) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message: "Permissions can only be assigned to account holders or auditors",
      });
    }

    // Auditors are strictly read-only.
    if (
      targetUser.role === "auditor" &&
      (
        can_deposit ||
        can_withdraw ||
        can_transfer ||
        can_adjust
      )
    ) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message: "Auditors can only receive view permission",
      });
    }

    const result = await client.query(
      `INSERT INTO account_permissions (
         user_id,
         account_id,
         can_view,
         can_deposit,
         can_withdraw,
         can_transfer,
         can_adjust,
         granted_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (user_id, account_id)
       DO UPDATE SET
         can_view = EXCLUDED.can_view,
         can_deposit = EXCLUDED.can_deposit,
         can_withdraw = EXCLUDED.can_withdraw,
         can_transfer = EXCLUDED.can_transfer,
         can_adjust = EXCLUDED.can_adjust
       RETURNING
         user_id,
         account_id,
         can_view,
         can_deposit,
         can_withdraw,
         can_transfer,
         can_adjust`,
      [
        userId,
        accountId,
        can_view,
        can_deposit,
        can_withdraw,
        can_transfer,
        can_adjust,
        adminId,
      ]
    );

    await client.query(
      `INSERT INTO audit_logs
       (actor_id, action, resource_type, resource_id, outcome, metadata)
       VALUES ($1, 'UPDATE_ACCOUNT_PERMISSIONS',
               'account_permission', $2, 'success', $3::jsonb)`,
      [
        adminId,
        accountId,
        JSON.stringify({
          target_user_id: userId,
          permissions,
        }),
      ]
    );

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: "Account permissions updated successfully",
      permissions: result.rows[0],
    });
  } catch (error) {
    if (client) {
      await client.query("ROLLBACK").catch(() => {});
    }

    console.error("Update permissions error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to update account permissions",
    });
  } finally {
    if (client) client.release();
  }
};

module.exports = {
  getAllUsers,
  updateUserStatus,
  getAccountPermissions,
  updateAccountPermissions,
};
