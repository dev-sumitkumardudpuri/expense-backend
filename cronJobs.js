import cron from "node-cron";
import Transaction from "./models/Transaction.js";

// Schedules an automated job to run every day at midnight (12:00 AM)
cron.schedule("0 0 * * *", async () => {
  try {
    console.log("Running automated recurring transaction checks...");

    const today = new Date();
    const currentDate = today.getDate();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();

    // Fetch all transaction templates scheduled to repeat monthly on the current calendar day
    const recurringTemplates = await Transaction.find({
      isRecurring: true,
      frequency: "monthly",
      recurringDate: currentDate,
    });

    if (recurringTemplates.length > 0) {
      const newTransactions = [];

      // Clean boundaries for the current month to check for existing duplicates
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

      for (const template of recurringTemplates) {
        // Check if an auto-generated instance already exists for this template in the current month
        const duplicateCheck = await Transaction.findOne({
          user: template.user,
          title: `${template.title} (Auto-Generated)`,
          date: { $gte: startOfMonth, $lte: endOfMonth },
        });

        // Only add to queue if it hasn't been generated yet for this month
        if (!duplicateCheck) {
          newTransactions.push({
            user: template.user,
            title: `${template.title} (Auto-Generated)`,
            amount: template.amount,
            type: template.type,
            category: template.category,
            date: new Date(),
            isRecurring: false,
          });
        }
      }

      // Bulk insert only if there are fresh instances to process
      if (newTransactions.length > 0) {
        await Transaction.insertMany(newTransactions);
        console.log(
          `${newTransactions.length} automated transactions added successfully.`,
        );
      } else {
        console.log(
          "No new recurring transactions needed; all instances already up to date.",
        );
      }
    }
  } catch (error) {
    console.error(
      "Error running automated recurring transactions:",
      error.message,
    );
  }
});
