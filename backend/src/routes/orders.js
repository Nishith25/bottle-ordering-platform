// backend/src/routes/orders.js

const crypto = require("crypto");
const express = require("express");

const { protect } = require(
  "../middleware/auth"
);

const Order = require("../models/Order");
const Product = require(
  "../models/Product"
);

const ServiceableLocation = require(
  "../models/ServiceableLocation"
);

const router = express.Router();

function generateOrderNumber() {
  const datePart = new Date()
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, "");

  const randomPart = crypto
    .randomBytes(3)
    .toString("hex")
    .toUpperCase();

  return `BO-${datePart}-${randomPart}`;
}

function cleanText(value) {
  return String(value || "").trim();
}

function cleanPhone(value) {
  return String(value || "").replace(
    /\D/g,
    ""
  );
}

function cleanPincode(value) {
  return String(value || "").replace(
    /\D/g,
    ""
  );
}

function validateAddress(address) {
  if (!address) {
    return "Delivery address is required.";
  }

  if (cleanText(address.fullName).length < 2) {
    return "A valid customer name is required.";
  }

  if (
    !/^[6-9]\d{9}$/.test(
      cleanPhone(address.phone)
    )
  ) {
    return "A valid 10-digit Indian mobile number is required.";
  }

  if (
    cleanPincode(address.pincode).length !==
    6
  ) {
    return "A valid six-digit pincode is required.";
  }

  if (
    cleanText(address.houseDetails).length <
    3
  ) {
    return "House, flat or building details are required.";
  }

  if (
    cleanText(address.areaDetails).length <
    3
  ) {
    return "Area and street details are required.";
  }

  return null;
}

function validateSchedule(schedule) {
  if (!schedule) {
    return "Delivery schedule is required.";
  }

  if (
    !cleanText(schedule.deliveryDateId) ||
    !cleanText(
      schedule.deliveryDateLabel
    ) ||
    !cleanText(schedule.deliverySlot)
  ) {
    return "Delivery date and slot are required.";
  }

  return null;
}

async function createUniqueOrderNumber() {
  for (
    let attempt = 0;
    attempt < 5;
    attempt += 1
  ) {
    const orderNumber =
      generateOrderNumber();

    const exists = await Order.exists({
      orderNumber,
    });

    if (!exists) {
      return orderNumber;
    }
  }

  throw new Error(
    "Unable to generate an order number."
  );
}

/**
 * POST /api/orders
 * Creates an order for the logged-in customer.
 */
router.post(
  "/",
  protect,
  async (req, res, next) => {
    try {
      const requestedItems =
        req.body.items;

      const deliveryAddress =
        req.body.deliveryAddress;

      const deliverySchedule =
        req.body.deliverySchedule;

      const paymentMethod =
        cleanText(
          req.body.paymentMethod
        ).toLowerCase();

      if (
        !Array.isArray(requestedItems) ||
        requestedItems.length === 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Add at least one bottle before placing an order.",
        });
      }

      if (
        !["cod", "online"].includes(
          paymentMethod
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Please choose a valid payment method.",
        });
      }

      const addressError =
        validateAddress(
          deliveryAddress
        );

      if (addressError) {
        return res.status(400).json({
          success: false,
          message: addressError,
        });
      }

      const scheduleError =
        validateSchedule(
          deliverySchedule
        );

      if (scheduleError) {
        return res.status(400).json({
          success: false,
          message: scheduleError,
        });
      }

      const pincode = cleanPincode(
        deliveryAddress.pincode
      );

      const serviceableLocation =
        await ServiceableLocation.findOne({
          pincode,
          active: true,
        }).lean();

      if (!serviceableLocation) {
        return res.status(400).json({
          success: false,
          message:
            "Delivery is not available for this pincode.",
        });
      }

      const quantitiesByProductId =
        new Map();

      for (const requestedItem of requestedItems) {
        const productId = cleanText(
          requestedItem.productId ||
            requestedItem.id
        ).toLowerCase();

        const quantity = Number(
          requestedItem.quantity
        );

        if (!productId) {
          return res.status(400).json({
            success: false,
            message:
              "An order item is missing its product ID.",
          });
        }

        if (
          !Number.isInteger(quantity) ||
          quantity < 1 ||
          quantity > 50
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Each bottle quantity must be between 1 and 50.",
          });
        }

        quantitiesByProductId.set(
          productId,
          (quantitiesByProductId.get(
            productId
          ) || 0) + quantity
        );
      }

      const requestedProductIds = [
        ...quantitiesByProductId.keys(),
      ];

      const products =
        await Product.find({
          productId: {
            $in: requestedProductIds,
          },
          available: true,
        }).lean();

      if (
        products.length !==
        requestedProductIds.length
      ) {
        return res.status(400).json({
          success: false,
          message:
            "One or more selected bottles are unavailable.",
        });
      }

      const orderItems = products.map(
        (product) => {
          const quantity =
            quantitiesByProductId.get(
              product.productId
            );

          const lineTotal =
            product.price * quantity;

          return {
            product: product._id,
            productId: product.productId,
            name: product.name,
            shortName:
              product.shortName,
            sizeMl: product.sizeMl,
            price: product.price,
            quantity,
            lineTotal,
          };
        }
      );

      const subtotal = orderItems.reduce(
        (sum, item) =>
          sum + item.lineTotal,
        0
      );

      if (
        subtotal <
        serviceableLocation.minimumOrder
      ) {
        return res.status(400).json({
          success: false,
          message: `The minimum order for ${serviceableLocation.area} is ₹${serviceableLocation.minimumOrder}.`,
        });
      }

      const deliveryFee =
        subtotal >= 399
          ? 0
          : serviceableLocation.deliveryFee;

      const total =
        subtotal + deliveryFee;

      const orderNumber =
        await createUniqueOrderNumber();

      const order = await Order.create({
        orderNumber,
        user: req.user._id,
        items: orderItems,

        deliveryAddress: {
          fullName: cleanText(
            deliveryAddress.fullName
          ),

          phone: cleanPhone(
            deliveryAddress.phone
          ),

          pincode,

          houseDetails: cleanText(
            deliveryAddress.houseDetails
          ),

          areaDetails: cleanText(
            deliveryAddress.areaDetails
          ),

          landmark: cleanText(
            deliveryAddress.landmark
          ),

          area:
            serviceableLocation.area,

          city:
            serviceableLocation.city,
        },

        deliverySchedule: {
          deliveryDateId: cleanText(
            deliverySchedule.deliveryDateId
          ),

          deliveryDateLabel: cleanText(
            deliverySchedule.deliveryDateLabel
          ),

          deliverySlot: cleanText(
            deliverySchedule.deliverySlot
          ),
        },

        subtotal,
        deliveryFee,
        total,
        paymentMethod,

        paymentStatus:
          paymentMethod === "cod"
            ? "pending"
            : "paid",

        paymentReference:
          paymentMethod === "online"
            ? `DEMO-${Date.now()}`
            : "",

        orderStatus: "placed",
      });

      return res.status(201).json({
        success: true,
        message:
          "Your order was placed successfully.",
        data: {
          order,
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * GET /api/orders/my
 * Returns orders belonging to the logged-in user.
 */
router.get(
  "/my",
  protect,
  async (req, res, next) => {
    try {
      const orders = await Order.find({
        user: req.user._id,
      })
        .sort({
          createdAt: -1,
        })
        .lean();

      return res.status(200).json({
        success: true,
        count: orders.length,
        data: {
          orders,
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * GET /api/orders/:orderId
 * Returns one order owned by the customer.
 */
router.get(
  "/:orderId",
  protect,
  async (req, res, next) => {
    try {
      const query = {
        _id: req.params.orderId,
      };

      if (req.user.role !== "admin") {
        query.user = req.user._id;
      }

      const order = await Order.findOne(
        query
      ).lean();

      if (!order) {
        return res.status(404).json({
          success: false,
          message: "Order not found.",
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          order,
        },
      });
    } catch (error) {
      if (
        error.name === "CastError"
      ) {
        return res.status(404).json({
          success: false,
          message: "Order not found.",
        });
      }

      return next(error);
    }
  }
);

/**
 * PATCH /api/orders/:orderId/cancel
 * Cancels a newly placed or confirmed order.
 */
router.patch(
  "/:orderId/cancel",
  protect,
  async (req, res, next) => {
    try {
      const order = await Order.findOne({
        _id: req.params.orderId,
        user: req.user._id,
      });

      if (!order) {
        return res.status(404).json({
          success: false,
          message: "Order not found.",
        });
      }

      if (
        ![
          "placed",
          "confirmed",
        ].includes(order.orderStatus)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "This order can no longer be cancelled.",
        });
      }

      order.orderStatus = "cancelled";

      order.cancellationReason =
        cleanText(
          req.body.reason
        ) ||
        "Cancelled by customer";

      order.cancelledAt = new Date();

      await order.save();

      return res.status(200).json({
        success: true,
        message:
          "Your order was cancelled.",
        data: {
          order,
        },
      });
    } catch (error) {
      if (
        error.name === "CastError"
      ) {
        return res.status(404).json({
          success: false,
          message: "Order not found.",
        });
      }

      return next(error);
    }
  }
);

module.exports = router;