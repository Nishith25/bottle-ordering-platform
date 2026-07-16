const express = require("express");
const mongoose = require("mongoose");

const {
  protect,
  allowRoles,
} = require("../middleware/auth");

const Product = require("../models/Product");
const InventoryMovement = require("../models/InventoryMovement");

const {
  logAdminActivity,
} = require("../services/adminActivityLogger");

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

function cleanText(value) {
  return String(value ?? "").trim();
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(
    object,
    key
  );
}

function createHttpError(
  message,
  statusCode = 400
) {
  const error = new Error(message);
  error.statusCode = statusCode;

  return error;
}

function parseWholeNumber(
  value,
  fieldName
) {
  const numberValue =
    Number(value);

  if (
    !Number.isInteger(numberValue) ||
    numberValue < 0
  ) {
    throw createHttpError(
      `${fieldName} must be a whole number greater than or equal to zero.`
    );
  }

  return numberValue;
}

function getActorSnapshot(user) {
  if (!user) {
    return null;
  }

  return {
    fullName:
      cleanText(user.fullName),

    email:
      cleanText(user.email).toLowerCase(),

    role:
      cleanText(user.role),
  };
}

async function createManualMovement({
  productBefore,
  productAfter,
  movementType,
  quantityChange,
  source,
  reason,
  actor,
  session,
}) {
  const stockBefore =
    Number(
      productBefore.stockQuantity ??
        0
    );

  const stockAfter =
    Number(
      productAfter.stockQuantity ??
        0
    );

  const thresholdBefore =
    Number(
      productBefore.lowStockThreshold ??
        0
    );

  const thresholdAfter =
    Number(
      productAfter.lowStockThreshold ??
        0
    );

  await InventoryMovement.create(
    [
      {
        product:
          productAfter._id,

        productId:
          productAfter.productId,

        productName:
          productAfter.name,

        movementType,

        direction:
          quantityChange > 0
            ? "in"
            : quantityChange < 0
              ? "out"
              : "neutral",

        quantityChange,
        stockBefore,
        stockAfter,

        lowStockThresholdBefore:
          thresholdBefore,

        lowStockThresholdAfter:
          thresholdAfter,

        source,
        sourceType: "admin",

        actor:
          actor?._id || null,

        actorSnapshot:
          getActorSnapshot(actor),

        reason,

        metadata: {
          changedBy:
            actor?._id
              ? String(actor._id)
              : "",
        },
      },
    ],
    {
      session,
    }
  );
}

/**
 * GET /api/admin/inventory/movements
 *
 * Optional query:
 * - productId=coconut-chia-refresh
 * - limit=50
 */
router.get(
  "/movements",
  async (req, res, next) => {
    try {
      const productId =
        cleanSlug(
          req.query.productId
        );

      const limitValue =
        Number(req.query.limit);

      const limit =
        Number.isInteger(limitValue)
          ? Math.min(
              Math.max(limitValue, 1),
              250
            )
          : 80;

      const filter = {};

      if (productId) {
        filter.productId =
          productId;
      }

      const movements =
        await InventoryMovement.find(
          filter
        )
          .populate(
            "actor",
            "fullName email role"
          )
          .sort({
            createdAt: -1,
          })
          .limit(limit)
          .lean();

      return res.status(200).json({
        success: true,
        count: movements.length,

        data: {
          movements,
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);

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
    const session =
      await mongoose.startSession();

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

      let updatedProduct = null;

      const activityMetadata = {
        productId,
        productName: "",
        stockBefore: null,
        stockAfter: null,
        stockChanged: false,
        quantityChange: 0,
        lowStockThresholdBefore: null,
        lowStockThresholdAfter: null,
        thresholdChanged: false,
        movementTypes: [],
        requestedAdjustment: null,
      };

      await session.withTransaction(
        async () => {
          const existingProduct =
            await Product.findOne({
              productId,
            }).session(session);

          if (!existingProduct) {
            throw createHttpError(
              "Product not found.",
              404
            );
          }

          activityMetadata.productName =
            existingProduct.name;

          const filter = {
            _id: existingProduct._id,
          };

          const update = {};

          let requestedAdjustment =
            null;

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
                req.body.lowStockThreshold,
                "Low-stock threshold"
              );

            update.$set = {
              ...(update.$set || {}),
              lowStockThreshold,
            };
          }

          if (hasAdjustment) {
            const adjustment =
              Number(
                req.body.adjustment
              );

            if (
              !Number.isInteger(
                adjustment
              ) ||
              adjustment === 0
            ) {
              throw createHttpError(
                "Stock adjustment must be a non-zero whole number."
              );
            }

            requestedAdjustment =
              adjustment;

            activityMetadata.requestedAdjustment =
              requestedAdjustment;

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

          const productBefore =
            await Product.findOneAndUpdate(
              filter,
              update,
              {
                new: false,
                runValidators: true,
                session,
              }
            );

          if (!productBefore) {
            throw createHttpError(
              "The stock adjustment would make the quantity negative."
            );
          }

          const productAfter =
            await Product.findById(
              existingProduct._id
            ).session(session);

          if (!productAfter) {
            throw createHttpError(
              "Product not found after update.",
              404
            );
          }

          const stockBefore =
            Number(
              productBefore.stockQuantity ??
                0
            );

          const stockAfter =
            Number(
              productAfter.stockQuantity ??
                0
            );

          const thresholdBefore =
            Number(
              productBefore.lowStockThreshold ??
                0
            );

          const thresholdAfter =
            Number(
              productAfter.lowStockThreshold ??
                0
            );

          activityMetadata.stockBefore =
            stockBefore;
          activityMetadata.stockAfter =
            stockAfter;
          activityMetadata.lowStockThresholdBefore =
            thresholdBefore;
          activityMetadata.lowStockThresholdAfter =
            thresholdAfter;

          if (
            stockBefore !== stockAfter
          ) {
            const quantityChange =
              stockAfter - stockBefore;

            activityMetadata.stockChanged =
              true;
            activityMetadata.quantityChange =
              quantityChange;

            activityMetadata.movementTypes.push(
              requestedAdjustment !== null
                ? "manual_adjustment"
                : "manual_set"
            );

            await createManualMovement({
              productBefore,
              productAfter,

              movementType:
                requestedAdjustment !==
                null
                  ? "manual_adjustment"
                  : "manual_set",

              quantityChange,

              source:
                requestedAdjustment !==
                null
                  ? "admin_stock_adjustment"
                  : "admin_stock_set",

              reason:
                requestedAdjustment !==
                null
                  ? `Admin adjusted stock by ${requestedAdjustment}.`
                  : `Admin set stock from ${stockBefore} to ${stockAfter}.`,

              actor:
                req.user,

              session,
            });
          }

          if (
            thresholdBefore !==
            thresholdAfter
          ) {
            activityMetadata.thresholdChanged =
              true;

            activityMetadata.movementTypes.push(
              "threshold_update"
            );

            await createManualMovement({
              productBefore,
              productAfter,

              movementType:
                "threshold_update",

              quantityChange: 0,

              source:
                "admin_threshold_update",

              reason:
                `Admin changed low-stock threshold from ${thresholdBefore} to ${thresholdAfter}.`,

              actor:
                req.user,

              session,
            });
          }

          updatedProduct =
            productAfter;
        }
      );

      const changedParts = [];

      if (activityMetadata.stockChanged) {
        changedParts.push(
          `stock ${activityMetadata.stockBefore} → ${activityMetadata.stockAfter}`
        );
      }

      if (activityMetadata.thresholdChanged) {
        changedParts.push(
          `threshold ${activityMetadata.lowStockThresholdBefore} → ${activityMetadata.lowStockThresholdAfter}`
        );
      }

      await logAdminActivity({
        req,
        actionType:
          "inventory_updated",

        actionLabel:
          "Inventory updated",

        severity:
          activityMetadata.stockChanged ||
          activityMetadata.thresholdChanged
            ? "success"
            : "info",

        message:
          changedParts.length > 0
            ? `${updatedProduct.name} ${changedParts.join(", ")}.`
            : `${updatedProduct.name} inventory was already up to date.`,

        entityType:
          "inventory",

        entityId:
          updatedProduct._id,

        entityLabel:
          updatedProduct.name,

        metadata:
          activityMetadata,
      });

      return res.status(200).json({
        success: true,

        message:
          "Product inventory updated successfully.",

        data: {
          product:
            updatedProduct,
        },
      });
    } catch (error) {
      return next(error);
    } finally {
      await session.endSession();
    }
  }
);

module.exports = router;