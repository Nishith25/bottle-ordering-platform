// backend/src/routes/auth.js

const express = require("express");
const jwt = require("jsonwebtoken");

const User = require("../models/User");
const { protect } = require("../middleware/auth");

const router = express.Router();

function createAccessToken(user) {
  const jwtSecret =
    process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new Error(
      "JWT_SECRET is missing from the backend environment."
    );
  }

  return jwt.sign(
    {
      userId: user._id.toString(),
      role: user.role,
    },
    jwtSecret,
    {
      expiresIn:
        process.env.JWT_EXPIRES_IN ||
        "7d",
    }
  );
}

function normaliseEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function normalisePhone(phone) {
  return String(phone || "").replace(
    /\D/g,
    ""
  );
}

function validateRegistration({
  fullName,
  email,
  phone,
  password,
}) {
  const errors = [];

  if (
    !fullName ||
    fullName.trim().length < 2
  ) {
    errors.push(
      "Full name must contain at least 2 characters."
    );
  }

  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      email
    )
  ) {
    errors.push(
      "Please provide a valid email address."
    );
  }

  if (!/^[6-9]\d{9}$/.test(phone)) {
    errors.push(
      "Please provide a valid 10-digit Indian mobile number."
    );
  }

  if (
    typeof password !== "string" ||
    password.length < 8
  ) {
    errors.push(
      "Password must contain at least 8 characters."
    );
  }

  return errors;
}

/**
 * POST /api/auth/register
 * Creates a new customer account.
 */
router.post(
  "/register",
  async (req, res, next) => {
    try {
      const fullName = String(
        req.body.fullName || ""
      ).trim();

      const email = normaliseEmail(
        req.body.email
      );

      const phone = normalisePhone(
        req.body.phone
      );

      const password =
        req.body.password;

      const validationErrors =
        validateRegistration({
          fullName,
          email,
          phone,
          password,
        });

      if (validationErrors.length > 0) {
        return res.status(400).json({
          success: false,
          message: validationErrors[0],
          errors: validationErrors,
        });
      }

      const existingUser =
        await User.findOne({
          $or: [
            {
              email,
            },
            {
              phone,
            },
          ],
        }).lean();

      if (existingUser) {
        const duplicateField =
          existingUser.email === email
            ? "email address"
            : "mobile number";

        return res.status(409).json({
          success: false,
          message: `An account already exists with this ${duplicateField}.`,
        });
      }

      const user = await User.create({
        fullName,
        email,
        phone,
        password,
        role: "customer",
      });

      const token =
        createAccessToken(user);

      return res.status(201).json({
        success: true,
        message:
          "Your account was created successfully.",
        data: {
          token,
          user: user.toPublicJSON(),
        },
      });
    } catch (error) {
      if (
        error.code === 11000
      ) {
        const field =
          Object.keys(
            error.keyPattern || {}
          )[0] || "account detail";

        return res.status(409).json({
          success: false,
          message: `An account already exists with this ${field}.`,
        });
      }

      return next(error);
    }
  }
);

/**
 * POST /api/auth/login
 * Logs in using email or mobile number.
 */
router.post(
  "/login",
  async (req, res, next) => {
    try {
      const identifier = String(
        req.body.identifier || ""
      ).trim();

      const password =
        req.body.password;

      if (
        !identifier ||
        typeof password !== "string" ||
        !password
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Email or mobile number and password are required.",
        });
      }

      const normalisedIdentifier =
        identifier.includes("@")
          ? normaliseEmail(identifier)
          : normalisePhone(identifier);

      const user = await User.findOne({
        $or: [
          {
            email:
              normalisedIdentifier,
          },
          {
            phone:
              normalisedIdentifier,
          },
        ],
      }).select("+password");

      if (!user) {
        return res.status(401).json({
          success: false,
          message:
            "The email, mobile number or password is incorrect.",
        });
      }

      if (!user.active) {
        return res.status(403).json({
          success: false,
          message:
            "This account has been disabled.",
        });
      }

      const passwordMatches =
        await user.comparePassword(
          password
        );

      if (!passwordMatches) {
        return res.status(401).json({
          success: false,
          message:
            "The email, mobile number or password is incorrect.",
        });
      }

      user.lastLoginAt = new Date();

      await user.save();

      const token =
        createAccessToken(user);

      return res.status(200).json({
        success: true,
        message:
          "You have logged in successfully.",
        data: {
          token,
          user: user.toPublicJSON(),
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * GET /api/auth/me
 * Returns the currently authenticated user.
 */
router.get(
  "/me",
  protect,
  async (req, res) => {
    return res.status(200).json({
      success: true,
      data: {
        user: req.user.toPublicJSON(),
      },
    });
  }
);

module.exports = router;