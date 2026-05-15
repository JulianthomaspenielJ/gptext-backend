const express = require("express");
const router = express.Router();
const deliverySchedule = require("../controllers/deliveryScheduleControllers")
const authMiddleware = require("../middleware/authMiddleware");


router.get("/list", authMiddleware.protect, deliverySchedule.getAllDeliverySchedules);
router.post("/create",authMiddleware.protect, deliverySchedule.createDeliverySchedule);
router.get("/get/:scheduleId",authMiddleware.protect, deliverySchedule.getDeliveryScheduleById );
router.put("/update/:scheduleId",authMiddleware.protect, deliverySchedule.updateDeliverySchedule);


module.exports = router;
