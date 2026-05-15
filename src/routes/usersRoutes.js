const express = require("express");
const router = express.Router();
const usersController = require("../controllers/usersControllers");
const authMiddleware = require("../middleware/authMiddleware");

router.post("/users-create",authMiddleware.protect, usersController.createUsers);
router.get("/users-options",authMiddleware.protect, usersController.getUsersOptions);
router.get("/users-getall",authMiddleware.protect, usersController.getAllUsers);
router.get("/roles-getall",authMiddleware.protect, usersController.getAllRoles);
router.post("/change-password",authMiddleware.protect, usersController.updatePassword);

// router.get("/weaver-getall", weaverController.getAllWeavers);
// router.get("/weaver-getbyid/:weaverid", weaverController.getWeaverById);
// router.delete("/weaver-delete/:weaverid", weaverController.deleteWeaverById);

module.exports = router;
