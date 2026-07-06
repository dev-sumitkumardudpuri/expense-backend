import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import Notification from "../models/Notification.js";

const router = express.Router();

/**
 * @desc    Get all unread notifications for the user
 * @route   GET /api/notifications
 * @access  Private
 */
router.get("/", protect, async (req, res) => {
  try {
    const notifications = await Notification.find({
      user: req.user.id,
      isRead: false,
    }).sort({ createdAt: -1 });

    return res.status(200).json({ success: true, data: notifications });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error while fetching notifications.",
    });
  }
});

/**
 * @desc    Mark all unread notifications as read
 * @route   PUT /api/notifications/read
 * @access  Private
 */
router.put("/read", protect, async (req, res) => {
  try {
    await Notification.updateMany(
      { user: req.user.id, isRead: false },
      { $set: { isRead: true } },
    );

    return res.status(200).json({
      success: true,
      message: "All notifications marked as read successfully.",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error while updating notifications.",
    });
  }
});

export default router;
