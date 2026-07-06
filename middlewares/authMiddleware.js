import jwt from "jsonwebtoken";
import User from "../models/User.js";

// Middleware to protect routes and validate JWT access tokens
export const protect = async (req, res, next) => {
  let token;

  // Check if the authorization header exists and starts with 'Bearer'
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      // Extract the token from the header (Bearer <token>)
      token = req.headers.authorization.split(" ")[1];

      // Verify the token using the server's JWT secret
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Fetch the user details from the database and exclude the password field
      req.user = await User.findById(decoded.id).select("-password");

      // Proceed to the next middleware or controller
      return next();
    } catch (error) {
      console.error("JWT Authentication Error:", error);
      return res.status(401).json({
        success: false,
        message: "Not authorized, token validation failed.",
      });
    }
  }

  // Return error if no token is found in the headers
  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Not authorized, no token provided.",
    });
  }
};
