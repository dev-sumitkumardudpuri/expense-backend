import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please add a name"],
    },
    email: {
      type: String,
      required: [true, "Please add an email"],
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
    },
    googleId: {
      type: String,
      default: null,
    },
    avatar: {
      type: String,
      default: "",
    },
    currency: {
      type: String,
      default: "₹",
    },
  },
  {
    timestamps: true,
  },
);

// 1. Pre-Save Hook: Encrypts/hashes the password before saving it to the database
userSchema.pre("save", async function () {
  // Skip hashing if the password has not been modified, or if it doesn't exist (e.g., Google OAuth users)
  if (!this.isModified("password") || !this.password) {
    return;
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  } catch (error) {
    throw error;
  }
});

// 2. Custom Method: Helper function to compare entered password with the hashed password
userSchema.methods.comparePassword = async function (enteredPassword) {
  // If the user has no password set (registered via Google OAuth), return false
  if (!this.password) return false;

  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model("User", userSchema);
export default User;
