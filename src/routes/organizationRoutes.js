const express = require("express");
const router = express.Router();
const organizationController = require("../controllers/organizationControllers");
const authMiddleware = require("../middleware/authMiddleware");
const upload = require("../middleware/fileupload");

router.post(
  "/organization-update",
  upload.single("logo"),
  authMiddleware.protect,
  organizationController.updateOrganization
);

router.get(
  "/organization-getbyid",
  authMiddleware.protect,
  organizationController.getOrganizationById
);

router.get(
  "/organization-options",
  authMiddleware.protect,
  organizationController.getOrganizationOptions
);

module.exports = router;
