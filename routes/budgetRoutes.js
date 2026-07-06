import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import Budget from "../models/Budget.js";
import Notification from "../models/Notification.js";

const router = express.Router();

// @desc    Set or Update monthly budget for a specific category
// @route   POST /api/budgets
router.post("/", protect, async (req, res) => {
  const { category, limitAmount, month, year } = req.body;
  try {
    let budget = await Budget.findOne({
      user: req.user.id,
      category,
      month,
      year,
    });

    if (budget) {
      budget.limitAmount = Number(limitAmount);
      await budget.save();
    } else {
      budget = await Budget.create({
        user: req.user.id,
        category,
        limitAmount: Number(limitAmount),
        month,
        year,
      });

      // Log system notification upon setting a new budget allocation
      await Notification.create({
        user: req.user.id,
        text: `A new monthly budget of INR ${limitAmount} has been configured for the "${category}" category.`,
        category,
        limitAmount: Number(limitAmount),
        month,
        year,
      });
    }
    res.status(200).json({ success: true, data: budget });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error setting budget." });
  }
});

// @desc    Get filtered budgets for the authenticated user
// @route   GET /api/budgets
router.get("/", protect, async (req, res) => {
  const { month, year } = req.query;
  try {
    const query = { user: req.user.id };
    if (month) query.month = Number(month);
    if (year) query.year = Number(year);

    const budgets = await Budget.find(query);
    res.status(200).json({ success: true, data: budgets });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: "Error fetching budgets." });
  }
});

// @desc    Delete an individual budget record & its notifications
// @route   DELETE /api/budgets/:id
router.delete("/:id", protect, async (req, res) => {
  try {
    // Locate and remove the specified budget record
    const budget = await Budget.findOneAndDelete({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!budget)
      return res
        .status(404)
        .json({ success: false, message: "Budget record not found." });

    // Cascade delete all notifications associated with this specific budget configuration
    await Notification.deleteMany({
      user: req.user.id,
      category: budget.category,
      month: budget.month,
      year: budget.year,
    });

    res.status(200).json({
      success: true,
      message:
        "The budget record and all linked notifications have been successfully removed.",
    });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: "Error deleting budget entry." });
  }
});

export default router;
