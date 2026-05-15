const express = require("express");
const router = express.Router();
const dailyProduction = require("../controllers/dailyProductionControllers");
const authMiddleware = require("../middleware/authMiddleware");


router.get("/list", authMiddleware.protect, dailyProduction.getDailyProduction);
router.put("/update", authMiddleware.protect, dailyProduction.updateProduction);
router.get(
  "/weekly-trend",
  authMiddleware.protect,
  dailyProduction.getWeeklyTrend
);
router.get(
  "/monthly-trend",
  authMiddleware.protect,
  dailyProduction.getMonthlyTrend
);

module.exports = router;
