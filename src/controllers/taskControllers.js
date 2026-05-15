const pool = require("../config/db");
const { v4: uuidv4 } = require("uuid");
const { sendAssignedTaskMail } = require("../utils/mailer");
const { sendPushNotificationToUser } = require("../utils/notification");
const { storeNotification } = require("./notificationControllers");

// CREATE TASK
exports.createTask = async (req, res) => {
  try {
    const {
      id,
      title,
      description,
      category,
      priority,
      assignedTo,
      assignedToId,
      orderId,
      dueDate,
      estimatedHours,
      status,
      progress,
      createdby,
      updatedby,
      mode,
    } = req.body.taskData;

    if (!title || !category || !assignedTo || !dueDate) {
      return res.status(400).json({ error: "Fill required fields" });
    }

    const sanitizedEstimatedHours =
      estimatedHours && estimatedHours.trim() !== ""
        ? Number(estimatedHours)
        : null;
    if (mode == "create") {
      const id = uuidv4(); // Generate unique ID

      const query = `INSERT INTO task (id, tasktitle, description, category, priority, assignedto, assignedtoid, relatedorder, duedate, estimatedhours, progress, status, createddate, updateddate, createdby, updatedby) 
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING *`;
      const values = [
        id,
        title,
        description,
        category,
        priority,
        assignedTo,
        assignedToId,
        orderId,
        dueDate,
        sanitizedEstimatedHours,
        progress,
        status,
        "NOW()",
        "NOW()",
        createdby,
        updatedby,
      ];

      console.log(query, values);
      const result = await pool.query(query, values);

      const userQuery = `SELECT name, email FROM users WHERE id = $1`;
      const userResult = await pool.query(userQuery, [assignedToId]);
      if (userResult.rows.length > 0) {
        const { name: userName, email } = userResult.rows[0];
        sendAssignedTaskMail(
          email,
          userName,
          title,
          description,
          dueDate,
          priority
        ).catch((err) => console.error("Error sending task email:", err));
      }
      try {
        await sendPushNotificationToUser(assignedToId, {
          title,
          body: description,
          // data,
        });
      } catch (err) {
        console.warn("Push notification not sent:", err.message);
      }

      const storedNotification = await storeNotification(assignedToId, {
        title,
        body: description,
        data: {},
        navigationUrl: "/tasks",
        type: "",
      });

      res.status(201).json({
        message: "Task created and email sent..",
        status: 201,
        task: result.rows[0],
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

exports.updateTaskStatusById = async (req, res) => {
  try {
    const { id, status, updatedby } = req.body.taskData;

    if (!id || !status) {
      return res.status(400).json({ error: "Fill required fields" });
    }

    const query = `UPDATE task SET  status = $1, updateddate = $2, updatedby = $3 WHERE id = $4 RETURNING *`;
    const values = [status, "NOW()", updatedby, id];
    const result = await pool.query(query, values);
    res.status(201).json({
      message: "Task Status updated",
      status: 201,
      task: result.rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

exports.updateTaskCommentById = async (req, res) => {
  try {
    const { id, comment, updatedby } = req.body.taskData;

    if (!id || !comment) {
      return res.status(400).json({ error: "Fill required fields" });
    }

    const query = `UPDATE task SET  comment = $1, updateddate = $2, updatedby = $3 WHERE id = $4 RETURNING *`;
    const values = [JSON.stringify(comment), "NOW()", updatedby, id];
    const result = await pool.query(query, values);
    res.status(201).json({
      message: "Task Comments updated",
      status: 201,
      task: result.rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
// GET TASKS
exports.getAllTasks = async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, tasktitle, description, category, priority, assignedto, assignedtoid, relatedorder, duedate, estimatedhours, progress, status, comment, createddate, updateddate, createdby, updatedby FROM Task ORDER BY updateddate DESC NULLS LAST"
    );
    res
      .status(200)
      .json({ message: "Tasks Retrieved successfully", task: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

exports.deleteLoomById = async (req, res) => {
  const loomId = req.params.loomid;
  console.log(loomId);
  try {
    const query = `DELETE FROM loom WHERE id = $1`;
    const values = [loomId];
    const result = await pool.query(query, values);
    res.status(200).json({ message: "Loom Deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

exports.getTaskOptions = async (_req, res) => {
  try {
    const taskCategoryQuery = `SELECT id, category FROM taskcategory WHERE status = 1 ORDER BY category `;
    const usersAssignToQuery = `SELECT id, name FROM users WHERE LOWER(Status) = 'active' ORDER BY name`;
    const orderQuery = `SELECT id, customername FROM orders ORDER BY customername`;

    // Run all queries in parallel
    const [taskcategory, users, orders] = await Promise.all([
      pool.query(taskCategoryQuery),
      pool.query(usersAssignToQuery),
      pool.query(orderQuery),
    ]);

    res.status(200).json({
      message: "All option values retrieved",
      taskCategory: taskcategory.rows,
      users: users.rows,
      orders: orders.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

exports.getWeavers = async (_req, res) => {
  try {
    const weaverResult = `SELECT id, name FROM weaver WHERE status = 'Active' ORDER BY name `;

    res.status(200).json({
      message: "Weavers retrieved successfully",
      weavers: weaverResult.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
