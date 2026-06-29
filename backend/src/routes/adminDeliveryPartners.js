const express = require("express");

const {
  protect,
  allowRoles,
} = require("../middleware/auth");

const Order = require("../models/Order");
const User = require("../models/User");

const router = express.Router();

router.use(protect);
router.use(allowRoles("admin"));

function cleanText(value) {
  return String(value || "").trim();
}

function normaliseEmail(value) {
  return cleanText(value).toLowerCase();
}

function normalisePhone(value) {
  return String(value || "").replace(/\D/g, "");
}

function validatePartnerInput(input, { partial = false } = {}) {
  const errors = [];

  const fullName = cleanText(input.fullName);
  const email = normaliseEmail(input.email);
  const phone = normalisePhone(input.phone);
  const password = String(input.password || "");

  if (!partial || input.fullName !== undefined) {
    if (fullName.length < 2) {
      errors.push("Full name must contain at least 2 characters.");
    }
  }

  if (!partial || input.email !== undefined) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push("Please provide a valid email address.");
    }
  }

  if (!partial || input.phone !== undefined) {
    if (!/^[6-9]\d{9}$/.test(phone)) {
      errors.push("Please provide a valid 10-digit Indian mobile number.");
    }
  }

  if (!partial || input.password !== undefined) {
    if (password.length < 8) {
      errors.push("Password must contain at least 8 characters.");
    }
  }

  return {
    errors,
    values: {
      fullName,
      email,
      phone,
      password,
    },
  };
}

async function buildPartnerPayload(partners) {
  const partnerIds = partners.map((partner) => partner._id);

  const activeAssignments = await Order.aggregate([
    {
      $match: {
        deliveryPartner: {
          $in: partnerIds,
        },
        orderStatus: {
          $nin: ["delivered", "cancelled"],
        },
      },
    },
    {
      $group: {
        _id: "$deliveryPartner",
        count: { $sum: 1 },
      },
    },
  ]);

  const assignmentCounts = new Map(
    activeAssignments.map((item) => [
      String(item._id),
      item.count,
    ])
  );

  return partners.map((partner) => ({
    ...partner.toPublicJSON(),
    activeAssignmentCount:
      assignmentCounts.get(String(partner._id)) || 0,
  }));
}

router.get("/", async (req, res, next) => {
  try {
    const partners = await User.find({
      role: "delivery",
    }).sort({
      active: -1,
      fullName: 1,
      createdAt: -1,
    });

    const data = await buildPartnerPayload(partners);

    return res.status(200).json({
      success: true,
      count: data.length,
      data: {
        partners: data,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { errors, values } = validatePartnerInput(req.body);

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: errors[0],
        errors,
      });
    }

    const existingUser = await User.findOne({
      $or: [
        { email: values.email },
        { phone: values.phone },
      ],
    }).lean();

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message:
          existingUser.email === values.email
            ? "An account already exists with this email address."
            : "An account already exists with this mobile number.",
      });
    }

    const partner = await User.create({
      fullName: values.fullName,
      email: values.email,
      phone: values.phone,
      password: values.password,
      role: "delivery",
      active: req.body.active !== false,
    });

    const [responsePartner] = await buildPartnerPayload([partner]);

    return res.status(201).json({
      success: true,
      message: "Delivery partner created successfully.",
      data: {
        partner: responsePartner,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.patch("/:partnerId", async (req, res, next) => {
  try {
    const { errors, values } = validatePartnerInput(req.body, {
      partial: true,
    });

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: errors[0],
        errors,
      });
    }

    const partner = await User.findOne({
      _id: req.params.partnerId,
      role: "delivery",
    });

    if (!partner) {
      return res.status(404).json({
        success: false,
        message: "Delivery partner not found.",
      });
    }

    if (req.body.active === false && partner.active) {
      const activeAssignment = await Order.exists({
        deliveryPartner: partner._id,
        orderStatus: {
          $nin: ["delivered", "cancelled"],
        },
      });

      if (activeAssignment) {
        return res.status(409).json({
          success: false,
          message:
            "Reassign this partner's active orders before disabling the account.",
        });
      }
    }

    if (req.body.email !== undefined) {
      const duplicateEmail = await User.exists({
        _id: { $ne: partner._id },
        email: values.email,
      });

      if (duplicateEmail) {
        return res.status(409).json({
          success: false,
          message: "An account already exists with this email address.",
        });
      }

      partner.email = values.email;
    }

    if (req.body.phone !== undefined) {
      const duplicatePhone = await User.exists({
        _id: { $ne: partner._id },
        phone: values.phone,
      });

      if (duplicatePhone) {
        return res.status(409).json({
          success: false,
          message: "An account already exists with this mobile number.",
        });
      }

      partner.phone = values.phone;
    }

    if (req.body.fullName !== undefined) {
      partner.fullName = values.fullName;
    }

    if (req.body.password !== undefined && values.password) {
      partner.password = values.password;
    }

    if (req.body.active !== undefined) {
      partner.active = Boolean(req.body.active);
    }

    await partner.save();

    const [responsePartner] = await buildPartnerPayload([partner]);

    return res.status(200).json({
      success: true,
      message: "Delivery partner updated successfully.",
      data: {
        partner: responsePartner,
      },
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(404).json({
        success: false,
        message: "Delivery partner not found.",
      });
    }

    return next(error);
  }
});

module.exports = router;
