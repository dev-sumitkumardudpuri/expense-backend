import express from "express";
import {
  addTransaction,
  getDashboardData,
  getAllTransactions,
  deleteTransaction,
} from "../controllers/transactionController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

/**
 * @desc    Add a new financial transaction (Income/Expense)
 * @route   POST /api/transactions
 * @access  Private
 */
router.post("/", protect, addTransaction);

/**
 * @desc    Get all transactions for the user (supports optional search filtering)
 * @route   GET /api/transactions
 * @access  Private
 */
router.get("/", protect, getAllTransactions);

/**
 * @desc    Get dashboard metrics, time-series chart data, and recent activity
 * @route   GET /api/transactions/dashboard
 * @access  Private
 */
router.get("/dashboard", protect, getDashboardData);

/**
 * @desc    Delete a specific transaction record by ID
 * @route   DELETE /api/transactions/:id
 * @access  Private
 */
router.delete("/:id", protect, deleteTransaction);

export default router;
