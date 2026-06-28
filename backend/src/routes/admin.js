// backend/src/routes/admin.js

const express = require("express");

const {
  protect,
  allowRoles,
} = require("../middleware/auth");

const Order = require("../models/Order");
const Product = require("../models/Product");
const ServiceableLocation = require(
  "../models/ServiceableLocation"
);
const Subscription = require(
  "../models/Subscription"
);
const SubscriptionPlan = require(
  "../models/SubscriptionPlan"
);
const User = require("../models/User");

const router = express.Router();

router.use(protect);
router.use(allowRoles("admin"));

function cleanText(value) {
  return String(value ?? "").trim();
}

function cleanSlug(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function cleanPincode(value) {
  return String(value ?? "").replace(
    /\D/g,
    ""
  );
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(
    object,
    key
  );
}

function parseBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return Boolean(value);
}

function createBadRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;

  return error;
}

function createNotFound(message) {
  const error = new Error(message);
  error.statusCode = 404;

  return error;
}

function mapBreakdown(items) {
  return items.reduce(
    (result, item) => {
      result[item._id] = item.count;
      return result;
    },
    {}
  );
}

/**
 * GET /api/admin/dashboard
 */
router.get(
  "/dashboard",
  async (req, res, next) => {
    try {
      const [
        totalProducts,
        activeProducts,
        totalCustomers,
        activeLocations,
        totalOrders,
        activeSubscriptions,
        orderValueResult,
        subscriptionValueResult,
        orderStatusResult,
        subscriptionStatusResult,
      ] = await Promise.all([
        Product.countDocuments(),

        Product.countDocuments({
          available: true,
        }),

        User.countDocuments({
          role: "customer",
        }),

        ServiceableLocation.countDocuments({
          active: true,
        }),

        Order.countDocuments(),

        Subscription.countDocuments({
          status: "active",
        }),

        Order.aggregate([
          {
            $match: {
              orderStatus: {
                $ne: "cancelled",
              },
            },
          },
          {
            $group: {
              _id: null,
              value: {
                $sum: "$total",
              },
            },
          },
        ]),

        Subscription.aggregate([
          {
            $match: {
              status: "active",
            },
          },
          {
            $group: {
              _id: null,
              value: {
                $sum: "$totalPerCycle",
              },
            },
          },
        ]),

        Order.aggregate([
          {
            $group: {
              _id: "$orderStatus",
              count: {
                $sum: 1,
              },
            },
          },
        ]),

        Subscription.aggregate([
          {
            $group: {
              _id: "$status",
              count: {
                $sum: 1,
              },
            },
          },
        ]),
      ]);

      return res.status(200).json({
        success: true,

        data: {
          totals: {
            products: totalProducts,
            activeProducts,
            customers: totalCustomers,
            activeLocations,
            orders: totalOrders,
            activeSubscriptions,

            orderValue:
              orderValueResult[0]?.value ??
              0,

            activeSubscriptionCycleValue:
              subscriptionValueResult[0]
                ?.value ?? 0,
          },

          orderStatusBreakdown:
            mapBreakdown(
              orderStatusResult
            ),

          subscriptionStatusBreakdown:
            mapBreakdown(
              subscriptionStatusResult
            ),
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);

/* -------------------------------------------------------------------------- */
/*                                  PRODUCTS                                  */
/* -------------------------------------------------------------------------- */

/**
 * GET /api/admin/products
 */
router.get(
  "/products",
  async (req, res, next) => {
    try {
      const products =
        await Product.find()
          .sort({
            sortOrder: 1,
            createdAt: 1,
          })
          .lean();

      return res.status(200).json({
        success: true,
        count: products.length,
        data: {
          products,
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * POST /api/admin/products
 */
router.post(
  "/products",
  async (req, res, next) => {
    try {
      const productId = cleanSlug(
        req.body.productId
      );

      const name = cleanText(
        req.body.name
      );

      const shortName = cleanText(
        req.body.shortName
      );

      if (!productId) {
        throw createBadRequest(
          "Product ID is required."
        );
      }

      if (!name || !shortName) {
        throw createBadRequest(
          "Product name and short name are required."
        );
      }

      const existingProduct =
        await Product.exists({
          productId,
        });

      if (existingProduct) {
        return res.status(409).json({
          success: false,
          message:
            "A product with this product ID already exists.",
        });
      }

      const product =
        await Product.create({
          productId,
          name,
          shortName,

          description: cleanText(
            req.body.description
          ),

          ingredients: Array.isArray(
            req.body.ingredients
          )
            ? req.body.ingredients
                .map(cleanText)
                .filter(Boolean)
            : [],

          sizeMl: Number(
            req.body.sizeMl
          ),

          price: Number(
            req.body.price
          ),

          category: cleanText(
            req.body.category
          ),

          imageUrl: cleanText(
            req.body.imageUrl
          ),

          liquidColor:
            cleanText(
              req.body.liquidColor
            ) || "#E8F0EA",

          cardColor:
            cleanText(
              req.body.cardColor
            ) || "#F2F6F2",

          accentColor:
            cleanText(
              req.body.accentColor
            ) || "#245C42",

          subscriptionEligible:
            hasOwn(
              req.body,
              "subscriptionEligible"
            )
              ? parseBoolean(
                  req.body
                    .subscriptionEligible
                )
              : true,

          available: hasOwn(
            req.body,
            "available"
          )
            ? parseBoolean(
                req.body.available
              )
            : true,

          sortOrder:
            Number(
              req.body.sortOrder
            ) || 0,
        });

      return res.status(201).json({
        success: true,
        message:
          "Product created successfully.",
        data: {
          product,
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * PATCH /api/admin/products/:productId
 */
router.patch(
  "/products/:productId",
  async (req, res, next) => {
    try {
      const productId = cleanSlug(
        req.params.productId
      );

      const update = {};

      const textFields = [
        "name",
        "shortName",
        "description",
        "category",
        "imageUrl",
        "liquidColor",
        "cardColor",
        "accentColor",
      ];

      for (const field of textFields) {
        if (hasOwn(req.body, field)) {
          update[field] = cleanText(
            req.body[field]
          );
        }
      }

      const numberFields = [
        "sizeMl",
        "price",
        "sortOrder",
      ];

      for (const field of numberFields) {
        if (hasOwn(req.body, field)) {
          update[field] = Number(
            req.body[field]
          );
        }
      }

      const booleanFields = [
        "subscriptionEligible",
        "available",
      ];

      for (const field of booleanFields) {
        if (hasOwn(req.body, field)) {
          update[field] =
            parseBoolean(
              req.body[field]
            );
        }
      }

      if (
        hasOwn(req.body, "ingredients")
      ) {
        if (
          !Array.isArray(
            req.body.ingredients
          )
        ) {
          throw createBadRequest(
            "Ingredients must be an array."
          );
        }

        update.ingredients =
          req.body.ingredients
            .map(cleanText)
            .filter(Boolean);
      }

      const product =
        await Product.findOneAndUpdate(
          {
            productId,
          },
          {
            $set: update,
          },
          {
            new: true,
            runValidators: true,
          }
        );

      if (!product) {
        throw createNotFound(
          "Product not found."
        );
      }

      return res.status(200).json({
        success: true,
        message:
          "Product updated successfully.",
        data: {
          product,
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * DELETE /api/admin/products/:productId
 *
 * This safely archives the product instead of
 * permanently removing order history references.
 */
router.delete(
  "/products/:productId",
  async (req, res, next) => {
    try {
      const product =
        await Product.findOneAndUpdate(
          {
            productId: cleanSlug(
              req.params.productId
            ),
          },
          {
            $set: {
              available: false,
            },
          },
          {
            new: true,
          }
        );

      if (!product) {
        throw createNotFound(
          "Product not found."
        );
      }

      return res.status(200).json({
        success: true,
        message:
          "Product archived successfully.",
        data: {
          product,
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);

/* -------------------------------------------------------------------------- */
/*                                  LOCATIONS                                 */
/* -------------------------------------------------------------------------- */

/**
 * GET /api/admin/locations
 */
router.get(
  "/locations",
  async (req, res, next) => {
    try {
      const locations =
        await ServiceableLocation.find()
          .sort({
            sortOrder: 1,
            pincode: 1,
          })
          .lean();

      return res.status(200).json({
        success: true,
        count: locations.length,
        data: {
          locations,
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * POST /api/admin/locations
 */
router.post(
  "/locations",
  async (req, res, next) => {
    try {
      const pincode = cleanPincode(
        req.body.pincode
      );

      if (pincode.length !== 6) {
        throw createBadRequest(
          "A valid six-digit pincode is required."
        );
      }

      const existingLocation =
        await ServiceableLocation.exists({
          pincode,
        });

      if (existingLocation) {
        return res.status(409).json({
          success: false,
          message:
            "This pincode already exists.",
        });
      }

      const location =
        await ServiceableLocation.create({
          pincode,

          area: cleanText(
            req.body.area
          ),

          city: cleanText(
            req.body.city
          ),

          deliveryFee: Number(
            req.body.deliveryFee
          ),

          minimumOrder: Number(
            req.body.minimumOrder
          ),

          active: hasOwn(
            req.body,
            "active"
          )
            ? parseBoolean(
                req.body.active
              )
            : true,

          sortOrder:
            Number(
              req.body.sortOrder
            ) || 0,
        });

      return res.status(201).json({
        success: true,
        message:
          "Delivery location created successfully.",
        data: {
          location,
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * PATCH /api/admin/locations/:pincode
 */
router.patch(
  "/locations/:pincode",
  async (req, res, next) => {
    try {
      const pincode = cleanPincode(
        req.params.pincode
      );

      const update = {};

      if (hasOwn(req.body, "area")) {
        update.area = cleanText(
          req.body.area
        );
      }

      if (hasOwn(req.body, "city")) {
        update.city = cleanText(
          req.body.city
        );
      }

      if (
        hasOwn(
          req.body,
          "deliveryFee"
        )
      ) {
        update.deliveryFee = Number(
          req.body.deliveryFee
        );
      }

      if (
        hasOwn(
          req.body,
          "minimumOrder"
        )
      ) {
        update.minimumOrder = Number(
          req.body.minimumOrder
        );
      }

      if (hasOwn(req.body, "active")) {
        update.active = parseBoolean(
          req.body.active
        );
      }

      if (
        hasOwn(req.body, "sortOrder")
      ) {
        update.sortOrder = Number(
          req.body.sortOrder
        );
      }

      const location =
        await ServiceableLocation.findOneAndUpdate(
          {
            pincode,
          },
          {
            $set: update,
          },
          {
            new: true,
            runValidators: true,
          }
        );

      if (!location) {
        throw createNotFound(
          "Delivery location not found."
        );
      }

      return res.status(200).json({
        success: true,
        message:
          "Delivery location updated successfully.",
        data: {
          location,
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * DELETE /api/admin/locations/:pincode
 */
router.delete(
  "/locations/:pincode",
  async (req, res, next) => {
    try {
      const location =
        await ServiceableLocation.findOneAndUpdate(
          {
            pincode: cleanPincode(
              req.params.pincode
            ),
          },
          {
            $set: {
              active: false,
            },
          },
          {
            new: true,
          }
        );

      if (!location) {
        throw createNotFound(
          "Delivery location not found."
        );
      }

      return res.status(200).json({
        success: true,
        message:
          "Delivery location disabled successfully.",
        data: {
          location,
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);

/* -------------------------------------------------------------------------- */
/*                                    PLANS                                   */
/* -------------------------------------------------------------------------- */

/**
 * GET /api/admin/plans
 */
router.get(
  "/plans",
  async (req, res, next) => {
    try {
      const plans =
        await SubscriptionPlan.find()
          .sort({
            sortOrder: 1,
            createdAt: 1,
          })
          .lean();

      return res.status(200).json({
        success: true,
        count: plans.length,
        data: {
          plans,
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * POST /api/admin/plans
 */
router.post(
  "/plans",
  async (req, res, next) => {
    try {
      const planId = cleanSlug(
        req.body.planId
      );

      if (!planId) {
        throw createBadRequest(
          "Plan ID is required."
        );
      }

      const existingPlan =
        await SubscriptionPlan.exists({
          planId,
        });

      if (existingPlan) {
        return res.status(409).json({
          success: false,
          message:
            "A subscription plan with this ID already exists.",
        });
      }

      const plan =
        await SubscriptionPlan.create({
          planId,

          name: cleanText(
            req.body.name
          ),

          description: cleanText(
            req.body.description
          ),

          billingCycle: cleanText(
            req.body.billingCycle
          ),

          bottleCount: Number(
            req.body.bottleCount
          ),

          deliveriesPerCycle: Number(
            req.body.deliveriesPerCycle
          ),

          discountPercent: Number(
            req.body.discountPercent
          ),

          badge: cleanText(
            req.body.badge
          ),

          features: Array.isArray(
            req.body.features
          )
            ? req.body.features
                .map(cleanText)
                .filter(Boolean)
            : [],

          active: hasOwn(
            req.body,
            "active"
          )
            ? parseBoolean(
                req.body.active
              )
            : true,

          sortOrder:
            Number(
              req.body.sortOrder
            ) || 0,
        });

      return res.status(201).json({
        success: true,
        message:
          "Subscription plan created successfully.",
        data: {
          plan,
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * PATCH /api/admin/plans/:planId
 */
router.patch(
  "/plans/:planId",
  async (req, res, next) => {
    try {
      const update = {};

      const textFields = [
        "name",
        "description",
        "billingCycle",
        "badge",
      ];

      for (const field of textFields) {
        if (hasOwn(req.body, field)) {
          update[field] = cleanText(
            req.body[field]
          );
        }
      }

      const numberFields = [
        "bottleCount",
        "deliveriesPerCycle",
        "discountPercent",
        "sortOrder",
      ];

      for (const field of numberFields) {
        if (hasOwn(req.body, field)) {
          update[field] = Number(
            req.body[field]
          );
        }
      }

      if (hasOwn(req.body, "active")) {
        update.active = parseBoolean(
          req.body.active
        );
      }

      if (
        hasOwn(req.body, "features")
      ) {
        if (
          !Array.isArray(
            req.body.features
          )
        ) {
          throw createBadRequest(
            "Plan features must be an array."
          );
        }

        update.features =
          req.body.features
            .map(cleanText)
            .filter(Boolean);
      }

      const plan =
        await SubscriptionPlan.findOneAndUpdate(
          {
            planId: cleanSlug(
              req.params.planId
            ),
          },
          {
            $set: update,
          },
          {
            new: true,
            runValidators: true,
          }
        );

      if (!plan) {
        throw createNotFound(
          "Subscription plan not found."
        );
      }

      return res.status(200).json({
        success: true,
        message:
          "Subscription plan updated successfully.",
        data: {
          plan,
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * DELETE /api/admin/plans/:planId
 */
router.delete(
  "/plans/:planId",
  async (req, res, next) => {
    try {
      const plan =
        await SubscriptionPlan.findOneAndUpdate(
          {
            planId: cleanSlug(
              req.params.planId
            ),
          },
          {
            $set: {
              active: false,
            },
          },
          {
            new: true,
          }
        );

      if (!plan) {
        throw createNotFound(
          "Subscription plan not found."
        );
      }

      return res.status(200).json({
        success: true,
        message:
          "Subscription plan archived successfully.",
        data: {
          plan,
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);

module.exports = router;