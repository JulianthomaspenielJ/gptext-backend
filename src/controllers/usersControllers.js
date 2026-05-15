const pool = require("../config/db");
const { v4: uuidv4 } = require("uuid");
const bcrypt = require("bcrypt");
const { sendTemporaryPasswordMail } = require("../utils/mailer");

// CREATE WEAVER
exports.createUsers = async (req, res) => {
  try {
    const {
      id,
      name,
      email,
      role,
      department,
      status,
      createdby,
      updatedby,
      mode,
    } = req.body.userData;

    if (!name || !email || !role) {
      return res.status(400).json({ error: "Fill required fields" });
    }

    console.log(mode);
    if (mode == "create") {
      // Check if email already exists
      const checkQuery = `SELECT id FROM Users WHERE email = $1`;
      const checkResult = await pool.query(checkQuery, [email]);

      if (checkResult.rows.length > 0) {
        return res.status(400).json({
          error:
            "This email is already registered. Please use a different email.",
        });
      }
      const id = uuidv4(); // Generate unique ID
      const tempPassword = "TempPassword@123";
      // Hash the temporary password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(tempPassword, saltRounds);
      const query = `INSERT INTO Users (id, name, email, username, password, roleid, department, status, createddate, updateddate, createdby, updatedby) 
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`;
      const values = [
        id,
        name,
        email,
        email,
        hashedPassword,
        role,
        department,
        status,
        "NOW()",
        "NOW()",
        createdby,
        updatedby,
      ];

      const result = await pool.query(query, values);
      if (status.toLowerCase() == "active") {
        // await sendTemporaryPasswordMail(email, tempPassword, name);
        sendTemporaryPasswordMail(email, tempPassword, name).catch((err) =>
          console.error("Error sending mail:", err)
        );
      }
      res.status(201).json({
        message: "User created and Mail sent",
        status: 201,
        users: result.rows[0],
      });
    } else if (mode == "edit") {
      const query = `UPDATE users SET name = $1, email = $2, roleid = $3, department = $4, status = $5, updateddate = $6, updatedby = $7 WHERE id = $8 RETURNING *`;
      const values = [
        name,
        email,
        role,
        department,
        status,
        "NOW()",
        updatedby,
        id,
      ];

      const result = await pool.query(query, values);
      res.status(201).json({
        message: "User updated",
        status: 201,
        users: result.rows[0],
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

exports.updatePassword = async (req, res) => {
  try {
    const { userid, currentPassword, newPassword, updatedby } = req.body;

    // if (!name || !email || !role) {
    //   return res.status(400).json({ error: "Fill required fields" });
    // }
    const saltRounds = 10;
    // const currentHashedPassword = await bcrypt.hash(
    //   currentPassword,
    //   saltRounds
    // );

    const passwordValidationQuery = `SELECT password FROM Users WHERE id = $1`;
    const validationResult = await pool.query(passwordValidationQuery, [
      userid,
    ]);
    console.log(validationResult);

    const user = validationResult.rows[0];
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch)
      return res
        .status(400)
        .json({ message: "Please check your current password.." });

    // if (validationResult.rows.length === 0) {
    //   return res.status(400).json({
    //     error: "Please check your current password.",
    //   });
    // }
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    const query = `UPDATE users SET password = $1, updateddate = $2, updatedby = $3 WHERE id = $4`;
    const values = [hashedPassword, "NOW()", updatedby, userid];

    const result = await pool.query(query, values);
    res.status(201).json({
      message: "Password updated successfully",
      status: 201,
      // users: result.rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

exports.getUsersOptions = async (_req, res) => {
  try {
    const usersRoleQuery = `SELECT id, name FROM roles WHERE status = 1 ORDER BY name ASC`;

    // Run all queries in parallel
    const [roles] = await Promise.all([pool.query(usersRoleQuery)]);

    res.status(200).json({
      message: "All option values retrieved",
      roles: roles.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
// GET USERS
exports.getAllUsers = async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, email, username, roleid, department, status, lastlogin, createddate, updateddate, createdby, updatedby FROM Users ORDER BY updateddate DESC"
    );
    res
      .status(200)
      .json({ message: "Users Retrieved successfully", users: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

exports.getAllRoles = async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, createddate, updateddate, createdby, updatedby FROM Roles ORDER BY name ASC"
    );
    res
      .status(200)
      .json({ message: "Roles Retrieved successfully", roles: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// // GET WEAVERSBYID
// exports.getWeaverById = async (req, res) => {
//   const weaverId = req.params.weaverid;
//   console.log(weaverId);
//   try {
//     const query = `SELECT id, name, email, status, phone, numberoflooms, address, city, state, gstnumber, pannumber, createddate, updateddate, createdby, updatedby FROM Weaver WHERE Id = $1`;
//     const values = [weaverId];
//     const result = await pool.query(query, values);
//     res
//       .status(200)
//       .json({ message: "Weaver Retrieved successfully", weaver: result.rows });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: err.message });
//   }
// };

// exports.deleteWeaverById = async (req, res) => {
//   const weaverId = req.params.weaverid;
//   console.log(weaverId);
//   try {
//     const query = `DELETE FROM weaver WHERE id = $1`;
//     const values = [weaverId];
//     const result = await pool.query(query, values);
//     res.status(200).json({ message: "Weaver Deleted successfully" });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: err.message });
//   }
// };
