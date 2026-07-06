import Transaction from "../models/Transaction.js";
import Budget from "../models/Budget.js";
import Notification from "../models/Notification.js";
import mongoose from "mongoose";

/**
 * @desc    Create a new transaction (Income/Expense), catch up historical instances if recurring, and evaluate budget status thresholds
 * @route   POST /api/transactions
 * @access  Private
 */
export const addTransaction = async (req, res) => {
  try {
    const {
      title,
      amount,
      type,
      category,
      date,
      isRecurring,
      frequency,
      recurringDate,
    } = req.body;

    if (!title || !amount || !type || !category) {
      return res.status(400).json({
        success: false,
        message: "All mandatory fields are required.",
      });
    }

    const userId = req.user.id;
    const parsedAmount = Number(amount);
    const inputDate = date ? new Date(date) : new Date();

    const transaction = await Transaction.create({
      user: userId,
      title,
      amount: parsedAmount,
      type,
      category,
      date: inputDate,
      isRecurring: isRecurring || false,
      frequency: isRecurring ? frequency || "monthly" : undefined,
      recurringDate: isRecurring ? Number(recurringDate) : undefined,
    });

    if (isRecurring && frequency === "monthly") {
      const today = new Date();
      let nextInstanceDate = new Date(inputDate);

      nextInstanceDate.setMonth(nextInstanceDate.getMonth() + 1);
      if (recurringDate) {
        nextInstanceDate.setDate(Number(recurringDate));
      }

      const catchUpTransactions = [];

      while (nextInstanceDate <= today) {
        catchUpTransactions.push({
          user: userId,
          title: `${title} (Auto-Generated)`,
          amount: parsedAmount,
          type,
          category,
          date: new Date(nextInstanceDate),
          isRecurring: false,
        });

        nextInstanceDate.setMonth(nextInstanceDate.getMonth() + 1);
      }

      if (catchUpTransactions.length > 0) {
        await Transaction.insertMany(catchUpTransactions);
      }
    }

    if (type === "expense") {
      const txDate = new Date(date || new Date());
      const currentMonth = txDate.getMonth() + 1;
      const currentYear = txDate.getFullYear();

      const budget = await Budget.findOne({
        user: userId,
        category,
        month: currentMonth,
        year: currentYear,
      });

      if (budget) {
        const startOfMonth = new Date(
          currentYear,
          currentMonth - 1,
          1,
          0,
          0,
          0,
          0,
        );
        const endOfMonth = new Date(
          currentYear,
          currentMonth,
          0,
          23,
          59,
          59,
          999,
        );

        const totalSpentData = await Transaction.aggregate([
          {
            $match: {
              user: new mongoose.Types.ObjectId(userId),
              type: "expense",
              category,
              date: { $gte: startOfMonth, $lte: endOfMonth },
            },
          },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ]);

        const totalSpent = totalSpentData[0]?.total || 0;

        const existingNotifications = await Notification.find({
          user: new mongoose.Types.ObjectId(userId),
          category,
          month: currentMonth,
          year: currentYear,
        }).catch(() => []);

        const has100Alert = existingNotifications.some(
          (n) => n.text && n.text.includes("100%"),
        );
        const has90Alert = existingNotifications.some(
          (n) => n.text && n.text.includes("90%"),
        );
        const has80Alert = existingNotifications.some(
          (n) => n.text && n.text.includes("80%"),
        );

        if (totalSpent >= budget.limitAmount && !has100Alert) {
          await Notification.create({
            user: userId,
            text: `Critical Alert: You have exceeded 100% of your budget for ${category}. Spent: INR ${totalSpent} / Limit: INR ${budget.limitAmount}`,
            category,
            limitAmount: budget.limitAmount,
            month: currentMonth,
            year: currentYear,
          }).catch((err) => console.error("Failed 100% alert:", err.message));
        } else if (
          totalSpent >= budget.limitAmount * 0.9 &&
          totalSpent < budget.limitAmount &&
          !has90Alert
        ) {
          await Notification.create({
            user: userId,
            text: `Warning: You have reached 90% of your budget for ${category}. Spent: INR ${totalSpent} / Limit: INR ${budget.limitAmount}`,
            category,
            limitAmount: budget.limitAmount,
            month: currentMonth,
            year: currentYear,
          }).catch((err) => console.error("Failed 90% alert:", err.message));
        } else if (
          totalSpent >= budget.limitAmount * 0.8 &&
          totalSpent < budget.limitAmount * 0.9 &&
          !has80Alert
        ) {
          await Notification.create({
            user: userId,
            text: `Notice: You have spent over 80% of your budget for ${category}. Spent: INR ${totalSpent} / Limit: INR ${budget.limitAmount}`,
            category,
            limitAmount: budget.limitAmount,
            month: currentMonth,
            year: currentYear,
          }).catch((err) => console.error("Failed 80% alert:", err.message));
        }
      }
    }

    return res.status(201).json({ success: true, data: transaction });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get dashboard metrics, trend chart data, and trigger dynamic insights (Date-range synced)
 * @route   GET /api/transactions/dashboard
 * @access  Private
 */
export const getDashboardData = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id);
    const { chartFilter = "monthly", referenceDate } = req.query;

    const baseDate = referenceDate ? new Date(referenceDate) : new Date();

    let startDateLimit = new Date(baseDate);
    let endDateLimit = new Date(baseDate);
    let formatString = "%Y-%m-%d";

    if (chartFilter === "today") {
      startDateLimit.setHours(0, 0, 0, 0);
      endDateLimit.setHours(23, 59, 59, 999);
      formatString = "%H:00";
    } else if (chartFilter === "weekly") {
      const currentDay = baseDate.getDay();
      startDateLimit.setDate(baseDate.getDate() - currentDay);
      startDateLimit.setHours(0, 0, 0, 0);
      endDateLimit.setDate(startDateLimit.getDate() + 6);
      endDateLimit.setHours(23, 59, 59, 999);
      formatString = "%d/%m";
    } else if (chartFilter === "yearly") {
      startDateLimit.setMonth(0, 1);
      startDateLimit.setHours(0, 0, 0, 0);
      endDateLimit.setMonth(11, 31);
      endDateLimit.setHours(23, 59, 59, 999);
      formatString = "%b";
    } else {
      startDateLimit.setDate(1);
      startDateLimit.setHours(0, 0, 0, 0);
      endDateLimit.setMonth(startDateLimit.getMonth() + 1, 0);
      endDateLimit.setHours(23, 59, 59, 999);
      formatString = "%d/%m";
    }

    const lifetimeStats = await Transaction.aggregate([
      { $match: { user: userId } },
      {
        $group: {
          _id: null,
          lifetimeIncome: {
            $sum: { $cond: [{ $eq: ["$type", "income"] }, "$amount", 0] },
          },
          lifetimeExpense: {
            $sum: { $cond: [{ $eq: ["$type", "expense"] }, "$amount", 0] },
          },
        },
      },
    ]);

    const globalIncome = lifetimeStats[0]?.lifetimeIncome || 0;
    const globalExpense = lifetimeStats[0]?.lifetimeExpense || 0;
    const accountBalance = globalIncome - globalExpense;
    const totalSavings = accountBalance > 0 ? accountBalance : 0;

    const intervalStats = await Transaction.aggregate([
      {
        $match: {
          user: userId,
          date: { $gte: startDateLimit, $lte: endDateLimit },
        },
      },
      {
        $group: {
          _id: null,
          intervalIncome: {
            $sum: { $cond: [{ $eq: ["$type", "income"] }, "$amount", 0] },
          },
          intervalExpense: {
            $sum: { $cond: [{ $eq: ["$type", "expense"] }, "$amount", 0] },
          },
        },
      },
    ]);

    const income = intervalStats[0]?.intervalIncome || 0;
    const expense = intervalStats[0]?.intervalExpense || 0;

    const currentMonth = baseDate.getMonth() + 1;
    const currentYear = baseDate.getFullYear();

    if (expense > 0) {
      const topCategoryData = await Transaction.aggregate([
        {
          $match: {
            user: userId,
            type: "expense",
            date: { $gte: startDateLimit, $lte: endDateLimit },
          },
        },
        { $group: { _id: "$category", total: { $sum: "$amount" } } },
        { $sort: { total: -1 } },
        { $limit: 1 },
      ]);

      if (topCategoryData.length > 0) {
        const topCat = topCategoryData[0]._id;
        const topCatAmount = topCategoryData[0].total;

        const notificationText = `Monthly Analytics Insight: Your highest expenditure this month was in the "${topCat}" category, totaling INR ${topCatAmount}.`;

        await Notification.findOneAndUpdate(
          {
            user: userId,
            month: currentMonth,
            year: currentYear,
            text: { $regex: "Monthly Analytics Insight", $options: "i" },
          },
          {
            $set: {
              text: notificationText,
              isRead: false,
            },
          },
          { upsert: true, new: true },
        ).catch((e) =>
          console.error(
            "Insight notification atomic transaction error:",
            e.message,
          ),
        );
      }
    }

    const rawChartData = await Transaction.aggregate([
      {
        $match: {
          user: userId,
          date: { $gte: startDateLimit, $lte: endDateLimit },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: formatString,
              date: "$date",
              timezone: "Asia/Kolkata",
            },
          },
          income: {
            $sum: { $cond: [{ $eq: ["$type", "income"] }, "$amount", 0] },
          },
          expense: {
            $sum: { $cond: [{ $eq: ["$type", "expense"] }, "$amount", 0] },
          },
        },
      },
    ]);

    let finalChartData = [];
    if (chartFilter === "today") {
      for (let i = 0; i < 24; i++) {
        const hourLabel = `${String(i).padStart(2, "0")}:00`;
        const found = rawChartData.find((d) => d._id === hourLabel);
        finalChartData.push({
          _id: hourLabel,
          income: found ? found.income : 0,
          expense: found ? found.expense : 0,
        });
      }
    } else if (chartFilter === "weekly") {
      let tempDate = new Date(startDateLimit);
      for (let i = 0; i < 7; i++) {
        const dayLabel = `${String(tempDate.getDate()).padStart(2, "0")}/${String(tempDate.getMonth() + 1).padStart(2, "0")}`;
        const found = rawChartData.find((d) => d._id === dayLabel);
        finalChartData.push({
          _id: dayLabel,
          income: found ? found.income : 0,
          expense: found ? found.expense : 0,
        });
        tempDate.setDate(tempDate.getDate() + 1);
      }
    } else if (chartFilter === "yearly") {
      const monthNames = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      for (let i = 0; i < 12; i++) {
        const monthLabel = monthNames[i];
        const found = rawChartData.find((d) => d._id === monthLabel);
        finalChartData.push({
          _id: monthLabel,
          income: found ? found.income : 0,
          expense: found ? found.expense : 0,
        });
      }
    } else {
      let totalDays = endDateLimit.getDate();
      let tempDate = new Date(startDateLimit);
      for (let i = 1; i <= totalDays; i++) {
        const dayLabel = `${String(tempDate.getDate()).padStart(2, "0")}/${String(tempDate.getMonth() + 1).padStart(2, "0")}`;
        const found = rawChartData.find((d) => d._id === dayLabel);
        finalChartData.push({
          _id: dayLabel,
          income: found ? found.income : 0,
          expense: found ? found.expense : 0,
        });
        tempDate.setDate(tempDate.getDate() + 1);
      }
    }

    const pieData = await Transaction.aggregate([
      {
        $match: {
          user: userId,
          type: "expense",
          date: { $gte: startDateLimit, $lte: endDateLimit },
        },
      },
      { $group: { _id: "$category", value: { $sum: "$amount" } } },
    ]);

    const recentFeed = await Transaction.find({ user: req.user.id })
      .sort({ date: -1 })
      .limit(6);

    return res.status(200).json({
      success: true,
      cards: {
        accountBalance,
        totalIncome: income,
        totalExpense: expense,
        totalSavings,
      },
      chartData: finalChartData,
      pieData,
      recentFeed,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get all transactions with optional search filtering
 * @route   GET /api/transactions
 * @access  Private
 */
export const getAllTransactions = async (req, res) => {
  try {
    const { search } = req.query;
    let query = { user: req.user.id };

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } },
      ];
    }

    const transactions = await Transaction.find(query).sort({ date: -1 });

    return res.status(200).json({
      success: true,
      count: transactions.length,
      data: transactions,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Delete a specific transaction record
 * @route   DELETE /api/transactions/:id
 * @access  Private
 */
export const deleteTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.findOne({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction record not found.",
      });
    }

    await transaction.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Transaction deleted successfully.",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Bulk Delete / Clear all transaction history
 * @route   DELETE /api/transactions/bulk/clear-all
 * @access  Private
 */
export const bulkDeleteTransactions = async (req, res) => {
  try {
    const userId = req.user.id;

    const count = await Transaction.countDocuments({ user: userId });
    if (count === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No data found to clear." });
    }

    await Transaction.deleteMany({ user: userId });

    await Notification.create({
      user: userId,
      text: `Security Alert: Your complete transaction history (Total ${count} records) has been cleared from the system.`,
    });

    return res.status(200).json({
      success: true,
      message: `All ${count} transactions deleted successfully. Security alert triggered.`,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
