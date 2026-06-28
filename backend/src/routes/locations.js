// backend/src/routes/locations.js

const express = require("express");

const ServiceableLocation = require(
  "../models/ServiceableLocation"
);

const router = express.Router();

/**
 * GET /api/locations
 * Returns all active serviceable delivery areas.
 */
router.get("/", async (req, res, next) => {
  try {
    const locations =
      await ServiceableLocation.find({
        active: true,
      })
        .sort({
          sortOrder: 1,
          area: 1,
        })
        .lean();

    return res.status(200).json({
      success: true,
      count: locations.length,
      data: locations,
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /api/locations/check/:pincode
 * Checks whether a customer pincode is serviceable.
 */
router.get(
  "/check/:pincode",
  async (req, res, next) => {
    try {
      const pincode = String(
        req.params.pincode
      ).replace(/\D/g, "");

      if (pincode.length !== 6) {
        return res.status(400).json({
          success: false,
          serviceable: false,
          message:
            "Please provide a valid six-digit pincode.",
        });
      }

      const location =
        await ServiceableLocation.findOne({
          pincode,
          active: true,
        }).lean();

      if (!location) {
        return res.status(200).json({
          success: true,
          serviceable: false,
          message:
            "Delivery is not currently available for this pincode.",
          data: null,
        });
      }

      return res.status(200).json({
        success: true,
        serviceable: true,
        message: "Delivery is available.",
        data: location,
      });
    } catch (error) {
      return next(error);
    }
  }
);

module.exports = router;