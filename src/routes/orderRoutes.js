const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderControllers");
const authMiddleware = require("../middleware/authMiddleware");

router.post("/create", authMiddleware.protect, orderController.createOrder);
router.put(
  "/update/:id",
  authMiddleware.protect,
  orderController.updateOrder
);
router.get("/list", authMiddleware.protect, orderController.getOrdersList);
router.get(
  "/get/:orderId",
  authMiddleware.protect,
  orderController.getByOrderId
);
router.delete(
  "/delete/:orderId",
  authMiddleware.protect,
  orderController.deleteOrder
);
router.put(
  "/update/timeaction/:id",
  authMiddleware.protect,
  orderController.updateTAPlan
);

module.exports = router;
