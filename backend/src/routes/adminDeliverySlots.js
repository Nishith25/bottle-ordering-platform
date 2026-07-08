const express =
  require("express");

const {
  protect,
  allowRoles,
} = require(
  "../middleware/auth"
);

const DeliverySlot =
  require(
    "../models/DeliverySlot"
  );

const {
  createDeliverySlotConfiguration,
  getDeliverySlotAvailability,
  listDeliverySlotConfigurations,
  updateDeliverySlotConfiguration,
} = require(
  "../services/deliverySlotService"
);

const router =
  express.Router();

router.use(protect);

router.use(
  allowRoles("admin")
);

/**
 * GET /api/admin/delivery-slots
 *
 * Optional preview:
 * ?pincode=500001&date=2026-07-10
 */
router.get(
  "/",

  async (
    req,
    res,
    next
  ) => {
    try {
      const configurations =
        await listDeliverySlotConfigurations({
          includeInactive:
            String(
              req.query
                .includeInactive ??
                "true"
            ).toLowerCase() !==
            "false",
        });

      let preview =
        null;

      if (
        req.query.pincode &&
        req.query.date
      ) {
        preview =
          await getDeliverySlotAvailability({
            pincode:
              req.query.pincode,

            deliveryDateId:
              req.query.date,
          });
      }

      return res
        .status(200)
        .json({
          success: true,

          count:
            configurations
              .length,

          data: {
            configurations,
            preview,
          },
        });
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * POST /api/admin/delivery-slots
 */
router.post(
  "/",

  async (
    req,
    res,
    next
  ) => {
    try {
      const slot =
        await createDeliverySlotConfiguration(
          req.body ||
            {}
        );

      const populatedSlot =
        await DeliverySlot.findById(
          slot._id
        )
          .populate(
            "serviceableLocation",

            "pincode area city active"
          )
          .lean();

      return res
        .status(201)
        .json({
          success: true,

          message:
            "Delivery slot created successfully.",

          data: {
            slot:
              populatedSlot,
          },
        });
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * PATCH /api/admin/delivery-slots/:slotId
 */
router.patch(
  "/:slotId",

  async (
    req,
    res,
    next
  ) => {
    try {
      const slot =
        await updateDeliverySlotConfiguration({
          slotId:
            req.params
              .slotId,

          input:
            req.body ||
            {},
        });

      const populatedSlot =
        await DeliverySlot.findById(
          slot._id
        )
          .populate(
            "serviceableLocation",

            "pincode area city active"
          )
          .lean();

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Delivery slot updated successfully.",

          data: {
            slot:
              populatedSlot,
          },
        });
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * DELETE /api/admin/delivery-slots/:slotId
 *
 * Soft-disable to preserve historical reservations.
 */
router.delete(
  "/:slotId",

  async (
    req,
    res,
    next
  ) => {
    try {
      const slot =
        await DeliverySlot.findByIdAndUpdate(
          req.params
            .slotId,

          {
            $set: {
              active: false,
            },
          },

          {
            new: true,
            runValidators:
              true,
          }
        );

      if (!slot) {
        return res
          .status(404)
          .json({
            success: false,

            message:
              "Delivery slot not found.",
          });
      }

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Delivery slot disabled successfully.",

          data: {
            slot,
          },
        });
    } catch (error) {
      return next(error);
    }
  }
);

module.exports =
  router;