const express = require("express");
const router = express.Router();
// import { register, login, profile } from "../controllers/authControllers.js";
const authController = require("../controllers/authControllers");

// import { protect } from "../middleware/authMiddleware.js";

// router.post("/register", register);
router.post("/login", authController.login);
router.get("/refresh-token", authController.refreshToken);
router.post("/logout", authController.logout);
router.post("/notification/save-token", authController.updateNotificationToken);

module.exports = router;
