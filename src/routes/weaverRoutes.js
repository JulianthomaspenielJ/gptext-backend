const express = require("express");
const router = express.Router();
const weaverController = require("../controllers/weaverControllers");
const authMiddleware = require("../middleware/authMiddleware");

router.post(
  "/weaver-create",
  authMiddleware.protect,
  weaverController.createWeaver
);
router.get(
  "/weaver-getall",
  authMiddleware.protect,
  weaverController.getAllWeavers
);
router.get(
  "/weaver-getbyid/:weaverid",
  authMiddleware.protect,
  weaverController.getWeaverById
);
router.delete(
  "/weaver-delete/:weaverid",
  authMiddleware.protect,
  weaverController.deleteWeaverById
);

module.exports = router;
