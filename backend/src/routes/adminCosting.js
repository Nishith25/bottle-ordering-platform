const express = require("express");

const {
  protect,
  allowRoles,
} = require("../middleware/auth");

const Product = require("../models/Product");
const ProductCost = require("../models/ProductCost");
const BusinessExpense = require("../models/BusinessExpense");

const router = express.Router();

router.use(protect);
router.use(allowRoles("admin"));

const EXPENSE_CATEGORIES = [
  "fruit",
  "juice",
  "bottle",
  "printing",
  "packaging",
  "delivery",
  "marketing",
  "labour",
  "rent",
  "utilities",
  "wastage",
  "other",
];

function cleanText(value) {
  return String(value ?? "").trim();
}

function getDateIdInIndia(offsetDays = 0) {
  const now = new Date();

  now.setDate(
    now.getDate() + offsetDays
  );

  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).format(now);
}

function parseDateId(value) {
  const dateId =
    cleanText(value) ||
    getDateIdInIndia();

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      dateId
    )
  ) {
    const error = new Error(
      "Please select a valid date."
    );

    error.statusCode = 400;
    throw error;
  }

  return dateId;
}

function buildUserSnapshot(user) {
  return {
    fullName:
      cleanText(user?.fullName) ||
      cleanText(user?.name) ||
      "Admin",

    email:
      cleanText(user?.email).toLowerCase(),

    role:
      cleanText(user?.role) ||
      "admin",
  };
}

function toNumber(value, fallback = 0) {
  const numberValue =
    Number(value);

  if (
    !Number.isFinite(numberValue) ||
    numberValue < 0
  ) {
    return fallback;
  }

  return numberValue;
}

function normalizeProductCost(cost) {
  const object =
    typeof cost.toObject === "function"
      ? cost.toObject({
          virtuals: true,
        })
      : cost;

  const baseCost =
    Number(object.bottleCost || 0) +
    Number(object.printingCost || 0) +
    Number(object.fruitCost || 0) +
    Number(object.juiceCost || 0) +
    Number(object.packagingCost || 0) +
    Number(object.deliveryCost || 0) +
    Number(object.otherCost || 0);

  const totalCost =
    Math.round(
      baseCost *
        (1 +
          Number(
            object.wastagePercent || 0
          ) /
            100)
    );

  return {
    _id:
      String(object._id),

    productId:
      object.productId,

    productName:
      object.productName,

    bottleCost:
      Number(object.bottleCost || 0),

    printingCost:
      Number(object.printingCost || 0),

    fruitCost:
      Number(object.fruitCost || 0),

    juiceCost:
      Number(object.juiceCost || 0),

    packagingCost:
      Number(object.packagingCost || 0),

    deliveryCost:
      Number(object.deliveryCost || 0),

    otherCost:
      Number(object.otherCost || 0),

    wastagePercent:
      Number(object.wastagePercent || 0),

    baseCost,

    totalCost,

    updatedBySnapshot:
      object.updatedBySnapshot ||
      null,

    createdAt:
      object.createdAt,

    updatedAt:
      object.updatedAt,
  };
}

function normalizeExpense(expense) {
  const object =
    typeof expense.toObject === "function"
      ? expense.toObject()
      : expense;

  return {
    _id:
      String(object._id),

    expenseDateId:
      object.expenseDateId,

    title:
      object.title,

    category:
      object.category,

    amount:
      Number(object.amount || 0),

    vendorName:
      object.vendorName || "",

    notes:
      object.notes || "",

    createdBySnapshot:
      object.createdBySnapshot ||
      null,

    createdAt:
      object.createdAt,

    updatedAt:
      object.updatedAt,
  };
}

async function ensureProductCostForProduct(
  product,
  user
) {
  const existing =
    await ProductCost.findOne({
      productId: product.productId,
    });

  if (existing) {
    return existing;
  }

  return ProductCost.create({
    productId:
      product.productId,

    productName:
      product.name,

    bottleCost:
      20,

    printingCost:
      10,

    updatedBy:
      user?._id || null,

    updatedBySnapshot:
      buildUserSnapshot(user),
  });
}

router.get(
  "/product-costs",
  async (req, res, next) => {
    try {
      const products =
        await Product.find({})
          .select(
            "productId name available sortOrder"
          )
          .sort({
            sortOrder: 1,
            name: 1,
          })
          .lean();

      const costs = [];

      for (const product of products) {
        const cost =
          await ensureProductCostForProduct(
            product,
            req.user
          );

        costs.push(
          normalizeProductCost(cost)
        );
      }

      return res.status(200).json({
        success: true,

        count:
          costs.length,

        data: {
          costs,
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);

router.patch(
  "/product-costs/:productId",
  async (req, res, next) => {
    try {
      const productId =
        cleanText(
          req.params.productId
        ).toLowerCase();

      const product =
        await Product.findOne({
          productId,
        }).lean();

      if (!product) {
        return res.status(404).json({
          success: false,
          message:
            "Product not found.",
        });
      }

      const update = {
        productId:
          product.productId,

        productName:
          product.name,

        bottleCost:
          toNumber(
            req.body.bottleCost
          ),

        printingCost:
          toNumber(
            req.body.printingCost
          ),

        fruitCost:
          toNumber(
            req.body.fruitCost
          ),

        juiceCost:
          toNumber(
            req.body.juiceCost
          ),

        packagingCost:
          toNumber(
            req.body.packagingCost
          ),

        deliveryCost:
          toNumber(
            req.body.deliveryCost
          ),

        otherCost:
          toNumber(
            req.body.otherCost
          ),

        wastagePercent:
          Math.min(
            toNumber(
              req.body.wastagePercent
            ),
            100
          ),

        updatedBy:
          req.user?._id || null,

        updatedBySnapshot:
          buildUserSnapshot(req.user),
      };

      const cost =
        await ProductCost.findOneAndUpdate(
          {
            productId:
              product.productId,
          },
          {
            $set:
              update,
          },
          {
            new: true,
            upsert: true,
            runValidators: true,
            setDefaultsOnInsert: true,
          }
        );

      return res.status(200).json({
        success: true,

        message:
          "Product cost updated.",

        data: {
          cost:
            normalizeProductCost(cost),
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);

router.get(
  "/expenses",
  async (req, res, next) => {
    try {
      const from =
        parseDateId(
          req.query.from
        );

      const to =
        parseDateId(
          req.query.to || from
        );

      if (from > to) {
        return res.status(400).json({
          success: false,
          message:
            "From date cannot be after to date.",
        });
      }

      const expenses =
        await BusinessExpense.find({
          expenseDateId: {
            $gte: from,
            $lte: to,
          },
        })
          .sort({
            expenseDateId: -1,
            createdAt: -1,
          })
          .lean();

      const categoryTotals = {};
      let totalAmount = 0;

      for (const expense of expenses) {
        const amount =
          Number(expense.amount || 0);

        totalAmount += amount;

        categoryTotals[
          expense.category
        ] =
          Number(
            categoryTotals[
              expense.category
            ] || 0
          ) + amount;
      }

      return res.status(200).json({
        success: true,

        count:
          expenses.length,

        data: {
          expenses:
            expenses.map(
              normalizeExpense
            ),

          summary: {
            totalAmount,

            categoryTotals,
          },
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);

router.post(
  "/expenses",
  async (req, res, next) => {
    try {
      const expenseDateId =
        parseDateId(
          req.body.expenseDateId
        );

      const title =
        cleanText(req.body.title);

      if (!title) {
        return res.status(400).json({
          success: false,
          message:
            "Expense title is required.",
        });
      }

      const category =
        EXPENSE_CATEGORIES.includes(
          cleanText(
            req.body.category
          )
        )
          ? cleanText(
              req.body.category
            )
          : "other";

      const amount =
        toNumber(req.body.amount);

      if (amount <= 0) {
        return res.status(400).json({
          success: false,
          message:
            "Expense amount must be greater than 0.",
        });
      }

      const expense =
        await BusinessExpense.create({
          expenseDateId,
          title,
          category,
          amount,

          vendorName:
            cleanText(
              req.body.vendorName
            ),

          notes:
            cleanText(req.body.notes),

          createdBy:
            req.user?._id || null,

          createdBySnapshot:
            buildUserSnapshot(req.user),
        });

      return res.status(201).json({
        success: true,

        message:
          "Expense recorded.",

        data: {
          expense:
            normalizeExpense(
              expense
            ),
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);

router.delete(
  "/expenses/:expenseId",
  async (req, res, next) => {
    try {
      const expense =
        await BusinessExpense.findByIdAndDelete(
          req.params.expenseId
        );

      if (!expense) {
        return res.status(404).json({
          success: false,
          message:
            "Expense not found.",
        });
      }

      return res.status(200).json({
        success: true,

        message:
          "Expense deleted.",
      });
    } catch (error) {
      return next(error);
    }
  }
);

module.exports = router;