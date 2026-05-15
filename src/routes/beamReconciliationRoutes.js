const express = require("express");
const router = express.Router();
const beamReconciliation = require("../controllers/beamReconciliationControllers");
const authMiddleware = require("../middleware/authMiddleware");

router.post("/create", authMiddleware.protect, beamReconciliation.createBeamReconciliation);
router.put(
  "/update/:id", authMiddleware.protect,
  beamReconciliation.updateBeamReconciliation
);
router.get("/list", authMiddleware.protect, beamReconciliation.getBeamReconciliationList);
router.get("/get/:id",authMiddleware.protect, beamReconciliation.getBeamReconciliationById);


module.exports = router;
