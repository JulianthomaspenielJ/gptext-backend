const express = require("express");
const router = express.Router();
const productionPlanningController = require("../controllers/productionPlanningControllers");
const authMiddleware = require("../middleware/authMiddleware");

router.get(
  "/productionplanning-getall",authMiddleware.protect,
  productionPlanningController.getAllProductionPlanning
);

module.exports = router;
