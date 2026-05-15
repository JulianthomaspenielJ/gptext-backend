// const express = require("express");
// const router = express.Router();
// const loomController = require("../controllers/loomControllers");
// const authMiddleware = require("../middleware/authMiddleware");

// router.post("/loom-create", authMiddleware.protect, loomController.createLoom);
// router.get("/loomtype", authMiddleware.protect, loomController.getDropdown);
// router.get(
//   "/loom-options",
//   authMiddleware.protect,
//   loomController.getLoomOptions
// );
// router.get("/type/:loomType",authMiddleware.protect, loomController.getByLoomType);
// router.get("/get/:loomid",authMiddleware.protect, loomController.getLoomById);

// router.get("/loom-getall", authMiddleware.protect, loomController.getAlllooms);
// // router.get("/weaver-getbyid/:weaverid", loomController.getWeaverById);
// router.delete(
//   "/loom-delete/:loomid",
//   authMiddleware.protect,
//   loomController.deleteLoomById
// );

// module.exports = router;

const express = require("express");
const router = express.Router();
const notifcationController = require("../controllers/notificationControllers");
const authMiddleware = require("../middleware/authMiddleware");

router.post(
  "/send-notification",
  authMiddleware.protect,
  notifcationController.sendToDevice
);
router.post(
  "/clear-token",
  authMiddleware.protect,
  notifcationController.clearToken
);
router.get(
  "/get-notification",
  authMiddleware.protect,
  notifcationController.getAllNotificationByUserId
);
router.put(
  "/update-notification",
  authMiddleware.protect,
  notifcationController.updateNotification
);
module.exports = router;
