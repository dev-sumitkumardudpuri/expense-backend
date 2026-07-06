import express from "express";
import {
  registerUser,
  loginUser,
  updateProfile,
  googleLogin,
} from "../controllers/authController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Authentication endpoints
router.post("/signup", registerUser);
router.post("/login", loginUser);

// Google OAuth endpoint
router.post("/google-login", googleLogin);

// User profile management (Handles both personal details and currency preferences)
router.put("/update-profile", protect, updateProfile);

export default router;
