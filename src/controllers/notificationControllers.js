const admin = require("firebase-admin");
const pool = require("../config/db");
const { v4: uuidv4 } = require("uuid");
const { sendPushNotificationToUser } = require("../utils/notification");

// Initialize Firebase only once
// if (!admin.apps.length) {
//   admin.initializeApp({
//     credential: admin.credential.cert(require("../firebaseConfig.json")),
//   });
// }

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
// Initialize Firebase only once
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

/**
 * Send push notification to a single device
 */
// exports.sendToDevice = async (req, res) => {
//   try {
//     const { userid, title, body, data, navigationUrl, type } =
//       req.body.notification;

//     const query = `SELECT notificationtoken FROM Users WHERE Id = $1;`;
//     const values = [userid];

//     console.log(query, values);
//     const notificationTokenResult = await pool.query(query, values);
//     const tokens = notificationTokenResult.rows[0].notificationtoken;
//     // console.log("Tokens received:", tokens);

//     const message = {
//       tokens,
//       data: { title, body },
//       //   data, // optional custom data
//     };

//     // const response = await admin.messaging().send(message);
//     const response = await admin.messaging().sendEachForMulticast(message);

//     // Step 3: Store the notification details in the notifications table
//     const notificationId = uuidv4();

//     const insertQuery = `
//       INSERT INTO notifications(id, title, body, notificationdata, read, navigationurl,assignedtoid, type, createddate, updateddate)
//       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);
//     `;
//     const insertValues = [
//       notificationId,
//       title,
//       body,
//       JSON.stringify(data) || {},
//       false,
//       navigationUrl,
//       userid,
//       type,
//       "NOW()",
//       "NOW()",
//     ];

//     await pool.query(insertQuery, insertValues);
//     // console.log(response);

//     res.status(200).json({
//       message: "Notification sent and stored successfully...",
//       successCount: response.successCount,
//       failureCount: response.failureCount,
//     });
//     // return response;
//   } catch (error) {
//     console.error("FCM Error:", error);
//     res.status(500).json({ error: error.message });
//   }
// };

exports.storeNotification = async (userId, notification) => {
  const { title, body, data, navigationUrl, type } = notification;

  const notificationId = uuidv4();

  const insertQuery = `
    INSERT INTO notifications(
      id, title, body, notificationdata, read,
      navigationurl, assignedtoid, type,
      createddate, updateddate
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW())
    RETURNING *;
  `;

  const insertValues = [
    notificationId,
    title,
    body,
    JSON.stringify(data || {}),
    false,
    navigationUrl,
    userId,
    type,
  ];

  const result = await pool.query(insertQuery, insertValues);
  return result.rows[0];
};

// exports.sendToDevice = async (req, res) => {
//   try {
//     const { userid, title, body, data, navigationUrl, type } =
//       req.body.notification;

//     /** Step 1: Send notification */
//     const response = await sendPushNotificationToUser(userid, {
//       title,
//       body,
//       data,
//     });

//     /** Step 2: Store notification */
//     const notificationId = uuidv4();

//     const insertQuery = `
//       INSERT INTO notifications(
//         id, title, body, notificationdata, read,
//         navigationurl, assignedtoid, type,
//         createddate, updateddate
//       )
//       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW());
//     `;

//     const insertValues = [
//       notificationId,
//       title,
//       body,
//       JSON.stringify(data || {}),
//       false,
//       navigationUrl,
//       userid,
//       type,
//     ];

//     await pool.query(insertQuery, insertValues);

//     res.status(200).json({
//       message: "Notification sent and stored successfully",
//       successCount: response.successCount,
//       failureCount: response.failureCount,
//     });
//   } catch (error) {
//     console.error("FCM Error:", error);
//     res.status(500).json({ error: error.message });
//   }
// };

exports.sendToDevice = async (req, res) => {
  try {
    const { userid, title, body, data, navigationUrl, type } =
      req.body.notification;

    // Step 1: Send notification
    let response = { successCount: 0, failureCount: 0 };
    try {
      response = await sendPushNotificationToUser(userid, {
        title,
        body,
        data,
      });
    } catch (err) {
      console.warn("Notification not sent:", err.message);
    }

    // Step 2: Store notification
    const storedNotification = await this.storeNotification(userid, {
      title,
      body,
      data,
      navigationUrl,
      type,
    });

    res.status(200).json({
      message: "Notification sent and stored successfully",
      // notification: storedNotification,
      successCount: response.successCount,
      failureCount: response.failureCount,
    });
  } catch (error) {
    console.error("FCM Error:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.clearToken = async (req, res) => {
  try {
    const { userId, token } = req.body;

    if (!userId || !token) {
      return res.status(400).json({ message: "Missing userId or token" });
    }

    // Step 1: Get the current notification tokens for the user
    const query = `SELECT notificationtoken FROM Users WHERE Id = $1;`;
    const result = await pool.query(query, [userId]);
    const currentTokens = result.rows[0]?.notificationtoken || [];

    // Step 2: Filter out the token that is being logged out
    const updatedTokens = currentTokens.filter((t) => t !== token);

    // Step 3: Update the database with the new list of tokens
    const updateQuery = `UPDATE Users SET notificationtoken = $2 WHERE Id = $1;`;
    const updateValues = [userId, JSON.stringify(updatedTokens)];

    await pool.query(updateQuery, updateValues);

    res
      .status(200)
      .json({ message: "Notification token removed successfully." });
  } catch (err) {
    console.error("Error removing token:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.getAllNotificationByUserId = async (req, res) => {
  try {
    const userId = req.query.userid;
    const query =
      "SELECT id, title, body, notificationdata, read, navigationurl, type, createddate FROM Notifications WHERE assignedtoid = $1 ORDER BY Createddate DESC";
    const values = [userId];
    const result = await pool.query(query, values);
    res.status(200).json({
      message: "Notifications Retrieved successfully",
      notifications: result.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

exports.updateNotification = async (req, res) => {
  const { notificationId, action, assignedtoid } = req.body;

  try {
    if (!action) {
      return res
        .status(400)
        .json({ success: false, message: "Action required" });
    }

    if (action === "read") {
      if (!notificationId) {
        return res
          .status(400)
          .json({ success: false, message: "notificationId required" });
      }
      await pool.query(
        "UPDATE Notifications SET read = true WHERE id = $1 AND assignedtoid = $2",
        [notificationId, assignedtoid]
      );
    } else if (action === "remove") {
      if (!notificationId) {
        return res
          .status(400)
          .json({ success: false, message: "notificationId required" });
      }
      await pool.query(
        "DELETE FROM Notifications WHERE id = $1 AND assignedtoid = $2",
        [notificationId, assignedtoid]
      );
    } else if (action === "markAllRead") {
      await pool.query(
        "UPDATE Notifications SET read = true WHERE assignedtoid = $1",
        [assignedtoid]
      );
    } else {
      return res
        .status(400)
        .json({ success: false, message: "Invalid action" });
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
};
