const admin = require("firebase-admin");
const pool = require("../config/db");

const getUserNotificationTokens = async (userid) => {
  const query = `SELECT notificationtoken FROM Users WHERE Id = $1`;
  const result = await pool.query(query, [userid]);

  return result.rows[0]?.notificationtoken || null;
};

const sendPushNotificationToUser = async (userid, payload) => {
  const tokens = await getUserNotificationTokens(userid);

  if (!tokens || (Array.isArray(tokens) && tokens.length === 0)) {
    throw new Error("No notification tokens found for user");
  }

  const message = {
    tokens: Array.isArray(tokens) ? tokens : [tokens],
    data: {
      title: payload.title,
      body: payload.body,
      ...(payload.data || {}),
    },
  };

  console.log(message);

  return admin.messaging().sendEachForMulticast(message);
};

module.exports = {
  sendPushNotificationToUser,
};
