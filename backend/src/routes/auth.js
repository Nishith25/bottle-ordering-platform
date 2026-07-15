const express = require("express");
const jwt = require("jsonwebtoken");

const User = require("../models/User");
const { protect } = require("../middleware/auth");

const router = express.Router();

const MAX_SAVED_ADDRESSES = 8;

function createAccessToken(user) {
  const jwtSecret = process.env.JWT_SECRET;

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
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    }
  );
}

function cleanText(value) {
  return String(value ?? "").trim();
}

function normaliseEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function normalisePhone(phone) {
  return String(phone || "").replace(/\D/g, "");
}

function normalisePincode(pincode) {
  return String(pincode || "")
    .replace(/\D/g, "")
    .slice(0, 6);
}

function validateRegistration({
  fullName,
  email,
  phone,
  password,
}) {
  const errors = [];

  if (!fullName || fullName.trim().length < 2) {
    errors.push(
      "Full name must contain at least 2 characters."
    );
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
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

function buildSavedAddressPayload(body, existing = {}) {
  const has = (field) =>
    Object.prototype.hasOwnProperty.call(
      body,
      field
    );

  return {
    label: has("label")
      ? cleanText(body.label) || "Home"
      : existing.label || "Home",

    fullName: has("fullName")
      ? cleanText(body.fullName)
      : cleanText(existing.fullName),

    phone: has("phone")
      ? normalisePhone(body.phone)
      : cleanText(existing.phone),

    pincode: has("pincode")
      ? normalisePincode(body.pincode)
      : cleanText(existing.pincode),

    houseDetails: has("houseDetails")
      ? cleanText(body.houseDetails)
      : cleanText(existing.houseDetails),

    areaDetails: has("areaDetails")
      ? cleanText(body.areaDetails)
      : cleanText(existing.areaDetails),

    landmark: has("landmark")
      ? cleanText(body.landmark)
      : cleanText(existing.landmark),

    area: has("area")
      ? cleanText(body.area)
      : cleanText(existing.area),

    city: has("city")
      ? cleanText(body.city)
      : cleanText(existing.city),

    isDefault: has("isDefault")
      ? Boolean(body.isDefault)
      : Boolean(existing.isDefault),
  };
}

function validateSavedAddress(address) {
  const errors = [];

  if (!address.label || address.label.length > 40) {
    errors.push(
      "Address label must be 1 to 40 characters."
    );
  }

  if (!address.fullName || address.fullName.length < 2) {
    errors.push(
      "Full name must contain at least 2 characters."
    );
  }

  if (!/^[6-9]\d{9}$/.test(address.phone)) {
    errors.push(
      "Please provide a valid 10-digit Indian mobile number."
    );
  }

  if (!/^\d{6}$/.test(address.pincode)) {
    errors.push(
      "Please provide a valid 6-digit pincode."
    );
  }

  if (
    !address.houseDetails ||
    address.houseDetails.length < 3
  ) {
    errors.push(
      "House, flat or building must contain at least 3 characters."
    );
  }

  if (
    !address.areaDetails ||
    address.areaDetails.length < 3
  ) {
    errors.push(
      "Area and street must contain at least 3 characters."
    );
  }

  if (!address.area) {
    errors.push(
      "Delivery area is required."
    );
  }

  if (!address.city) {
    errors.push(
      "Delivery city is required."
    );
  }

  return errors;
}

function normalizeDefaultAddress(user, defaultAddressId = "") {
  if (!Array.isArray(user.savedAddresses)) {
    user.savedAddresses = [];
    return;
  }

  if (user.savedAddresses.length === 0) {
    return;
  }

  const requestedDefaultId =
    cleanText(defaultAddressId);

  let defaultFound = false;

  user.savedAddresses.forEach((address, index) => {
    const shouldBeDefault =
      requestedDefaultId
        ? String(address._id) === requestedDefaultId
        : Boolean(address.isDefault) && !defaultFound;

    address.isDefault = shouldBeDefault;

    if (shouldBeDefault) {
      defaultFound = true;
    }

    if (!requestedDefaultId && !defaultFound && index === 0) {
      address.isDefault = true;
      defaultFound = true;
    }
  });

  if (!defaultFound) {
    user.savedAddresses[0].isDefault = true;
  }
}

function getAddressById(user, addressId) {
  if (!addressId) {
    return null;
  }

  return user.savedAddresses.id(addressId);
}

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

      const password = req.body.password;

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
      if (error.code === 11000) {
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

router.post(
  "/login",
  async (req, res, next) => {
    try {
      const identifier = String(
        req.body.identifier || ""
      ).trim();

      const password = req.body.password;

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

router.post(
  "/addresses",
  protect,
  async (req, res, next) => {
    try {
      const user = req.user;

      if (
        Array.isArray(user.savedAddresses) &&
        user.savedAddresses.length >= MAX_SAVED_ADDRESSES
      ) {
        return res.status(400).json({
          success: false,
          message: `You can save up to ${MAX_SAVED_ADDRESSES} delivery addresses.`,
        });
      }

      const addressPayload =
        buildSavedAddressPayload(req.body);

      if (
        !user.savedAddresses ||
        user.savedAddresses.length === 0
      ) {
        addressPayload.isDefault = true;
      }

      const validationErrors =
        validateSavedAddress(addressPayload);

      if (validationErrors.length > 0) {
        return res.status(400).json({
          success: false,
          message: validationErrors[0],
          errors: validationErrors,
        });
      }

      if (addressPayload.isDefault) {
        user.savedAddresses.forEach((address) => {
          address.isDefault = false;
        });
      }

      user.savedAddresses.push(addressPayload);

      const addedAddress =
        user.savedAddresses[
          user.savedAddresses.length - 1
        ];

      normalizeDefaultAddress(
        user,
        addressPayload.isDefault
          ? String(addedAddress._id)
          : ""
      );

      await user.save();

      const publicUser =
        user.toPublicJSON();

      const publicAddress =
        publicUser.savedAddresses.find(
          (address) =>
            address.id === String(addedAddress._id)
        );

      return res.status(201).json({
        success: true,
        message:
          "Delivery address saved successfully.",
        data: {
          user: publicUser,
          address: publicAddress,
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);

router.patch(
  "/addresses/:addressId",
  protect,
  async (req, res, next) => {
    try {
      const user = req.user;

      const address =
        getAddressById(
          user,
          req.params.addressId
        );

      if (!address) {
        return res.status(404).json({
          success: false,
          message:
            "Saved address not found.",
        });
      }

      const mergedAddress =
        buildSavedAddressPayload(
          req.body,
          address
        );

      const validationErrors =
        validateSavedAddress(
          mergedAddress
        );

      if (validationErrors.length > 0) {
        return res.status(400).json({
          success: false,
          message: validationErrors[0],
          errors: validationErrors,
        });
      }

      address.label = mergedAddress.label;
      address.fullName =
        mergedAddress.fullName;
      address.phone =
        mergedAddress.phone;
      address.pincode =
        mergedAddress.pincode;
      address.houseDetails =
        mergedAddress.houseDetails;
      address.areaDetails =
        mergedAddress.areaDetails;
      address.landmark =
        mergedAddress.landmark;
      address.area = mergedAddress.area;
      address.city = mergedAddress.city;
      address.isDefault =
        Boolean(mergedAddress.isDefault);

      if (address.isDefault) {
        normalizeDefaultAddress(
          user,
          String(address._id)
        );
      } else {
        normalizeDefaultAddress(user);
      }

      await user.save();

      const publicUser =
        user.toPublicJSON();

      const publicAddress =
        publicUser.savedAddresses.find(
          (savedAddress) =>
            savedAddress.id ===
            String(address._id)
        );

      return res.status(200).json({
        success: true,
        message:
          "Saved address updated successfully.",
        data: {
          user: publicUser,
          address: publicAddress,
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);

router.delete(
  "/addresses/:addressId",
  protect,
  async (req, res, next) => {
    try {
      const user = req.user;

      const address =
        getAddressById(
          user,
          req.params.addressId
        );

      if (!address) {
        return res.status(404).json({
          success: false,
          message:
            "Saved address not found.",
        });
      }

      address.deleteOne();

      normalizeDefaultAddress(user);

      await user.save();

      return res.status(200).json({
        success: true,
        message:
          "Saved address deleted successfully.",
        data: {
          user: user.toPublicJSON(),
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);

module.exports = router;