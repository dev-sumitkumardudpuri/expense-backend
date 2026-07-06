import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./db.js";
import "./cronJobs.js";

// Core Routing Modules Imports
import authRoutes from "./routes/authRoutes.js";
import transactionRoutes from "./routes/transactionRoutes.js";
import budgetRoutes from "./routes/budgetRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";

// Initialize environment configuration
dotenv.config();

// Establish connection to the database instance
connectDB();

const app = express();

// Configure Cross-Origin Resource Sharing (CORS)
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  }),
);

// Built-in body parser middleware for JSON payloads
app.use(express.json());

// ─── API ROUTE MOUNTING ───
app.use("/api/auth", authRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/budgets", budgetRoutes);
app.use("/api/notifications", notificationRoutes);

// Server Status Root Checkpoint
app.get("/", (req, res) => {
  res.send("Expense Tracker Backend Server is Running!");
});

// Initialize HTTP listener on designated execution port
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running successfully on port ${PORT}`);
});
