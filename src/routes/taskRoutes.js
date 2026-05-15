const express = require("express");
const router = express.Router();
const taskController = require("../controllers/taskControllers");
const authMiddleware = require("../middleware/authMiddleware");

router.post("/task-create", authMiddleware.protect, taskController.createTask);
router.post(
  "/task-update",
  authMiddleware.protect,
  taskController.updateTaskStatusById
);
router.post(
  "/task-update-comments",
  authMiddleware.protect,
  taskController.updateTaskCommentById
);

// router.get("/loomtype", loomController.getDropdown);
router.get(
  "/task-options",
  authMiddleware.protect,
  taskController.getTaskOptions
);
router.get("/task-getall", authMiddleware.protect, taskController.getAllTasks);
// router.get("/loom-getall", loomController.getAlllooms);
// router.get("/weaver-getbyid/:weaverid", loomController.getWeaverById);
// router.delete("/loom-delete/:loomid", loomController.deleteLoomById);

module.exports = router;
