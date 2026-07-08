const express =
  require("express");

const {
  getDeliverySlotAvailability,
  getDeliverySlotCatalog,
} = require(
  "../services/deliverySlotService"
);

const router =
  express.Router();

/**
 * GET /api/delivery-slots/catalog
 *
 * Optional:
 * ?pincode=500001
 */
router.get(
  "/catalog",

  async (
    req,
    res,
    next
  ) => {
    try {
      const result =
        await getDeliverySlotCatalog({
          pincode:
            req.query.pincode,
        });

      return res
        .status(200)
        .json({
          success: true,

          count:
            result.slots
              .length,

          data: {
            location:
              result.location,

            slots:
              result.slots,
          },
        });
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * GET /api/delivery-slots/availability
 *
 * Required:
 * ?pincode=500001&date=2026-07-10
 */
router.get(
  "/availability",

  async (
    req,
    res,
    next
  ) => {
    try {
      const result =
        await getDeliverySlotAvailability({
          pincode:
            req.query.pincode,

          deliveryDateId:
            req.query.date,
        });

      return res
        .status(200)
        .json({
          success: true,

          count:
            result.slots
              .length,

          data: {
            location:
              result.location,

            deliveryDateId:
              result
                .deliveryDateId,

            slots:
              result.slots,
          },
        });
    } catch (error) {
      return next(error);
    }
  }
);

module.exports =
  router;