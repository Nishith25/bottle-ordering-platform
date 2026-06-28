// backend/src/routes/adminInventory.js

const express = require("express");

const {
  protect,
  allowRoles,
} = require("../middleware/auth");

const Product = require(
  "../models/Product"
);

const router = express.Router();

router.use(protect);
router.use(allowRoles("admin"));

function cleanSlug(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(
    object,
    key
  );
}

function parseWholeNumber(
  value,
  fieldName
) {
  const numberValue =
    Number(value);

  if (
    !Number.isInteger(
      numberValue
    ) ||
    numberValue < 0
  ) {
    const error = new Error(
      `${fieldName} must be a whole number greater than or equal to zero.`
    );

    error.statusCode = 400;
    throw error;
  }

  return numberValue;
}

/**
 * PATCH /api/admin/inventory/:productId
 *
 * Body can contain:
 * {
 *   stockQuantity: 50,
 *   lowStockThreshold: 10
 * }
 *
 * Or:
 * {
 *   adjustment: 10
 * }
 */
router.patch(
  "/:productId",
  async (req, res, next) => {
    try {
      const productId =
        cleanSlug(
          req.params.productId
        );

      const hasStockQuantity =
        hasOwn(
          req.body,
          "stockQuantity"
        );

      const hasThreshold =
        hasOwn(
          req.body,
          "lowStockThreshold"
        );

      const hasAdjustment =
        hasOwn(
          req.body,
          "adjustment"
        );

      if (
        !hasStockQuantity &&
        !hasThreshold &&
        !hasAdjustment
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Provide a stock quantity, adjustment or low-stock threshold.",
        });
      }

      if (
        hasStockQuantity &&
        hasAdjustment
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Use either stock quantity or stock adjustment, not both.",
        });
      }

      const filter = {
        productId,
      };

      const update = {};

      if (hasStockQuantity) {
        const stockQuantity =
          parseWholeNumber(
            req.body.stockQuantity,
            "Stock quantity"
          );

        update.$set = {
          ...(update.$set || {}),

          stockQuantity,
        };
      }

      if (hasThreshold) {
        const lowStockThreshold =
          parseWholeNumber(
            req.body
              .lowStockThreshold,

            "Low-stock threshold"
          );

        update.$set = {
          ...(update.$set || {}),

          lowStockThreshold,
        };
      }

      if (hasAdjustment) {
        const adjustment = Number(
          req.body.adjustment
        );

        if (
          !Number.isInteger(
            adjustment
          ) ||
          adjustment === 0
        ) {
          return res.status(400).json({
            success: false,

            message:
              "Stock adjustment must be a non-zero whole number.",
          });
        }

        if (adjustment < 0) {
          filter.stockQuantity = {
            $gte:
              Math.abs(
                adjustment
              ),
          };
        }

        update.$inc = {
          stockQuantity:
            adjustment,
        };
      }

      const product =
        await Product.findOneAndUpdate(
          filter,
          update,
          {
            new: true,
            runValidators: true,
          }
        );

      if (!product) {
        const existingProduct =
          await Product.exists({
            productId,
          });

        if (!existingProduct) {
          return res.status(404).json({
            success: false,

            message:
              "Product not found.",
          });
        }

        return res.status(400).json({
          success: false,

          message:
            "The stock adjustment would make the quantity negative.",
        });
      }

      return res.status(200).json({
        success: true,

        message:
          "Product inventory updated successfully.",

        data: {
          product,
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);

module.exports = router;