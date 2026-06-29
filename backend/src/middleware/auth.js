const jwt = require("jsonwebtoken");

const User = require("../models/User");

async function protect(req, res, next) {
  try {
    const authorizationHeader =
      req.headers.authorization || "";

    const [scheme, token] =
      authorizationHeader.split(" ");

    if (
      scheme !== "Bearer" ||
      !token
    ) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication is required. Please log in.",
      });
    }

    const jwtSecret =
      process.env.JWT_SECRET;

    if (!jwtSecret) {
      throw new Error(
        "JWT_SECRET is missing from the backend environment."
      );
    }

    const decoded = jwt.verify(
      token,
      jwtSecret
    );

    const user = await User.findById(
      decoded.userId
    );

    if (!user || !user.active) {
      return res.status(401).json({
        success: false,
        message:
          "This account is unavailable or has been disabled.",
      });
    }

    req.user = user;

    return next();
  } catch (error) {
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      return res.status(401).json({
        success: false,
        message:
          error.name === "TokenExpiredError"
            ? "Your session has expired. Please log in again."
            : "Your authentication token is invalid.",
      });
    }

    return next(error);
  }
}

function allowRoles(...roles) {
  return function roleMiddleware(
    req,
    res,
    next
  ) {
    if (
      !req.user ||
      !roles.includes(req.user.role)
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have permission to perform this action.",
      });
    }

    return next();
  };
}

module.exports = {
  protect,
  allowRoles,
};
