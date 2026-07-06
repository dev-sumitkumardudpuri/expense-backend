import mongoose from "mongoose";

const NotificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
      required: true,
    },
    category: String,
    limitAmount: Number,
    month: Number,
    year: Number,
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

NotificationSchema.index({ user: 1, category: 1, month: 1, year: 1 });

export default mongoose.model("Notification", NotificationSchema);
