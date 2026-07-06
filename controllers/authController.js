import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Notification from "../models/Notification.js";

// --- Helper Function: Generate Authentication Token ---
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "7d", // Token remains valid for 7 days
  });
};

// @desc    Register a new user (Signup)
// @route   POST /api/auth/signup
export const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please fill in all fields properly.",
      });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    const user = await User.create({
      name,
      email,
      password,
    });

    if (user) {
      // Optional: Send a welcome notification upon successful registration
      await Notification.create({
        user: user._id,
        text: `🎉 Welcome to Expense Tracker, ${name}! Your account has been successfully created.`,
      }).catch((e) => console.log("Welcome notification error:", e.message));

      res.status(201).json({
        success: true,
        message: "Registration successful!",
        token: generateToken(user._id),
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          currency: user.currency,
        },
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Authenticate a user (Login)
// @route   POST /api/auth/login
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please enter both email and password.",
      });
    }

    const user = await User.findOne({ email });

    if (user && (await user.comparePassword(password))) {
      res.json({
        success: true,
        message: "Login successful!",
        token: generateToken(user._id),
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          currency: user.currency,
        },
      });
    } else {
      res
        .status(401)
        .json({ success: false, message: "Invalid email or password." });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Google OAuth Login and Signup
// @route   POST /api/auth/google-login
export const googleLogin = async (req, res) => {
  try {
    const { name, email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Google authentication failed. Identity email is missing.",
      });
    }

    let user = await User.findOne({ email });

    if (!user) {
      user = await User.create({
        name: name || "Google User",
        email: email,
        googleId: "google_" + Math.random().toString(36).substring(2, 11),
      });

      // Send a welcome notification for Google OAuth registrations
      await Notification.create({
        user: user._id,
        text: `Welcome to Expense Tracker, ${user.name}! Your account has been successfully registered via Google.`,
      }).catch((e) =>
        console.log("Google welcome notification error:", e.message),
      );
    }

    res.status(200).json({
      success: true,
      message: "Google login successful!",
      token: generateToken(user._id),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        currency: user.currency,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update user profile details and currency settings
// @route   PUT /api/auth/profile
export const updateProfile = async (req, res) => {
  try {
    const { name, email, currency } = req.body;
    const userId = req.user.id;

    // Fetch the current user data before updating to verify currency preferences
    const currentUser = await User.findById(userId);

    if (!currentUser) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const oldCurrency = currentUser.currency || "USD";

    // Update profile fields by user ID
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { name, email, currency },
      { new: true },
    ).select("-password");

    if (currency && currency !== oldCurrency) {
      await Notification.create({
        user: userId,
        text: `💱 Currency Updated: Your primary currency settings have been changed from "${oldCurrency}" to "${currency}".`,
      }).catch((e) =>
        console.error("Currency notification trigger failed:", e.message),
      );
    }

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Update Profile Error:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error during profile update" });
  }
};
