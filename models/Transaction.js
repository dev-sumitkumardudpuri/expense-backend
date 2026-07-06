import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: [true, "Please add a title"],
      trim: true,
    },
    amount: {
      type: Number,
      required: [true, "Please add an amount"],
    },
    type: {
      type: String,
      required: [true, "Please specify type"],
      enum: ["income", "expense"],
    },
    category: {
      type: String,
      required: [true, "Please select a category"],
    },
    date: {
      type: Date,
      required: [true, "Please add a date"],
      default: Date.now,
    },

    // -----------------------------------------------------------------
    // RECURRING FIELDS: For handling automated recurring income or expenses
    // -----------------------------------------------------------------
    isRecurring: {
      type: Boolean,
      default: false,
    },
    frequency: {
      type: String,
      enum: ["daily", "weekly", "monthly"],
      default: "monthly",
    },
    recurringDate: {
      type: Number,
      min: 1,
      max: 31,
    },
  },
  {
    timestamps: true,
  },
);

const Transaction = mongoose.model("Transaction", transactionSchema);
export default Transaction;
