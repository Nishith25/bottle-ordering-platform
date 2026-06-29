const express = require("express");

const {
  protect,
} = require("../middleware/auth");

const Product = require(
  "../models/Product"
);

const Subscription = require(
  "../models/Subscription"
);

const {
  getSubscriptionEditState,
  updateFutureSubscription,
} = require(
  "../services/subscriptionUpdate"
);

const router = express.Router();

function cleanText(value) {
  return String(value ?? "").trim();
}

router.get(
  "/:subscriptionId/edit-options",
  protect,
  async (
    req,
    res,
    next
  ) => {
    try {
      const subscription =
        await Subscription.findOne({
          _id:
            req.params.subscriptionId,

          user:
            req.user._id,
        }).lean();

      if (!subscription) {
        return res.status(404).json({
          success: false,

          message:
            "Subscription not found.",
        });
      }

      const currentProductIds =
        subscription.items.map(
          (item) =>
            cleanText(
              item.productId
            ).toLowerCase()
        );

      const products =
        await Product.find({
          $or: [
            {
              available: true,

              subscriptionEligible:
                true,
            },

            {
              productId: {
                $in:
                  currentProductIds,
              },
            },
          ],
        })
          .sort({
            sortOrder: 1,
            createdAt: 1,
          })
          .select(
            "_id productId name shortName sizeMl price available subscriptionEligible"
          )
          .lean();

      const editState =
        getSubscriptionEditState(
          subscription
        );

      return res.status(200).json({
        success: true,

        data: {
          subscription,
          products,

          canEdit:
            editState.canEdit,

          editDeadline:
            editState.editDeadline,

          editMessage:
            editState.reason,
        },
      });
    } catch (error) {
      if (
        error.name ===
        "CastError"
      ) {
        return res.status(404).json({
          success: false,

          message:
            "Subscription not found.",
        });
      }

      return next(error);
    }
  }
);

router.patch(
  "/:subscriptionId/edit",
  protect,
  async (
    req,
    res,
    next
  ) => {
    try {
      const subscription =
        await updateFutureSubscription({
          subscriptionId:
            req.params.subscriptionId,

          userId:
            req.user._id,

          input:
            req.body,
        });

      return res.status(200).json({
        success: true,

        message:
          "Your subscription was updated successfully. Changes will apply to future delivery orders.",

        data: {
          subscription,
        },
      });
    } catch (error) {
      if (
        error.name ===
        "CastError"
      ) {
        return res.status(404).json({
          success: false,

          message:
            "Subscription not found.",
        });
      }

      return next(error);
    }
  }
);

module.exports = router;