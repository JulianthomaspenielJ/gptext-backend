const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");

// Generate tokens
const createAccessToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.ACCESS_TOKEN_EXPIRES,
  });

const createRefreshToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.REFRESH_TOKEN_EXPIRES,
  });

// REGISTER
// export const register = async (req, res) => {
//   try {
//     const { name, email, password } = req.body;

//     const exists = await pool.query("SELECT * FROM users WHERE email=$1", [email]);
//     if (exists.rows.length > 0)
//       return res.status(400).json({ message: "Email already exists" });

//     const hashed = await bcrypt.hash(password, 10);
//     const result = await pool.query(
//       "INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email",
//       [name, email, hashed]
//     );

//     res.status(201).json({ message: "User registered", user: result.rows[0] });
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// };

// LOGIN
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query("SELECT * FROM users WHERE email=$1", [
      email,
    ]);
    if (result.rows.length === 0)
      return res.status(400).json({ message: "Invalid credentials" });

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid credentials" });

    const accessToken = createAccessToken(user.id);
    const refreshToken = createRefreshToken(user.id);

    // Set HttpOnly cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    const roleResult = await pool.query("SELECT name FROM roles WHERE id=$1", [
      user.roleid,
    ]);

    res.json({
      success: true,
      token: accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: roleResult.rows[0].name,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// REFRESH TOKEN
exports.refreshToken = (req, res) => {
  try {
    const token = req.cookies.refreshToken;
    if (!token) return res.status(401).json({ message: "No refresh token" });

    const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET);

    const accessToken = createAccessToken(payload.id);

    res.json({ accessToken });
  } catch (err) {
    res.status(401).json({ message: "Invalid refresh token" });
  }
};

// LOGOUT
exports.logout = (req, res) => {
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });
  res.json({ message: "Logged out successfully" });
};
exports.updateNotificationToken = async (req, res) => {
  try {
    const { userId, token } = req.body;

    if (!userId || !token) {
      return res.status(400).json({ message: "Missing userId or token" });
    }

    // Step 1: Get the current notificationtoken array
    const query = `SELECT notificationtoken FROM Users WHERE id = $1;`;
    const result = await pool.query(query, [userId]);

    const currentTokens = result.rows[0]?.notificationtoken || [];

    // Step 2: Check if the token already exists in the array
    if (currentTokens.includes(token)) {
      return res.status(200).json({ message: "Token already exists" });
    }

    // Step 3: Append the new token to the array
    currentTokens.push(token);

    // Step 4: Update the user's notificationtoken with the new array
    const updateQuery = `
      UPDATE Users
      SET notificationtoken = $2
      WHERE id = $1;
    `;
    const updateValues = [userId, JSON.stringify(currentTokens)];

    await pool.query(updateQuery, updateValues);

    res.status(200).json({ message: "Token saved successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// exports.updateNotificationToken = async (req, res) => {
//   try {
//     const { userId, token } = req.body;

//     if (!userId || !token) {
//       return res.status(400).json({ message: "Missing userId or token" });
//     }

//     // Update the user's notificationtoken field (JSON array)
//     const query = `
//       UPDATE Users
//       SET notificationtoken =
//         CASE
//           WHEN notificationtoken @> $2 THEN notificationtoken  -- If the token already exists, don't update
//           ELSE notificationtoken || $2  -- If the token doesn't exist, append it to the array
//         END
//       WHERE id = $1;
//     `;

//     const values = [userId, JSON.stringify([token])];

//     await pool.query(query, values);

//     res.status(200).json({ message: "Token saved successfully" });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: err.message });
//   }
// };

// // LOGIN
// exports.login = async (req, res) => {
//   try {
//     const { email, password } = req.body;

//     const result = await pool.query("SELECT * FROM users WHERE email = $1", [
//       email,
//     ]);

//     if (result.rows.length === 0) {
//       return res.status(400).json({ message: "Invalid credentials" });
//     }

//     const user = result.rows[0];

//     const match = await bcrypt.compare(password, user.password);
//     if (!match) {
//       return res.status(400).json({ message: "Invalid credentials" });
//     }

//     const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
//       expiresIn: "1d",
//     });

//     res.json({
//       message: "Login success",
//       token,
//       user: {
//         id: user.id,
//         name: user.name,
//         email: user.email,
//       },
//     });
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// };
