// backend/src/routes/adminSalesReports.js

const express = require("express");

const {
  protect,
  allowRoles,
} = require("../middleware/auth");

const Order = require("../models/Order");
const ProductCost = require("../models/ProductCost");
const BusinessExpense = require("../models/BusinessExpense");

const router = express.Router();

router.use(protect);
router.use(allowRoles("admin"));

const IST_OFFSET_MS =
  5.5 * 60 * 60 * 1000;

const ACTIVE_SALES_STATUSES = [
  "placed",
  "confirmed",
  "preparing",
  "out_for_delivery",
  "delivered",
];

const CANCELLED_STATUSES = [
  "cancelled",
];

function cleanText(value) {
  return String(value ?? "").trim();
}

function getDateIdInIst(date = new Date()) {
  return new Date(
    date.getTime() + IST_OFFSET_MS
  )
    .toISOString()
    .slice(0, 10);
}

function parseDateId(value, fallback) {
  const dateId =
    cleanText(value) || fallback;

  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      dateId
    );

  if (!match) {
    const error = new Error(
      "Please select a valid date."
    );

    error.statusCode = 400;
    throw error;
  }

  return dateId;
}

function createIstRange(
  fromDateId,
  toDateId
) {
  const from =
    new Date(
      `${fromDateId}T00:00:00.000+05:30`
    );

  const to =
    new Date(
      `${toDateId}T00:00:00.000+05:30`
    );

  const toExclusive =
    new Date(
      to.getTime() +
        24 * 60 * 60 * 1000
    );

  if (from.getTime() > to.getTime()) {
    const error = new Error(
      "From date cannot be after to date."
    );

    error.statusCode = 400;
    throw error;
  }

  return {
    from,
    toExclusive,
  };
}

function getOrderDateId(order) {
  return getDateIdInIst(
    new Date(order.createdAt)
  );
}

function getItemValue(item) {
  const lineTotal =
    Number(item.lineTotal || 0);

  if (
    Number.isFinite(lineTotal) &&
    lineTotal > 0
  ) {
    return lineTotal;
  }

  return (
    Number(item.price || 0) *
    Number(item.quantity || 0)
  );
}

function addMoney(value) {
  const numberValue =
    Number(value || 0);

  return Number.isFinite(numberValue)
    ? numberValue
    : 0;
}

function getCostTotal(cost, fallback) {
  if (!cost) {
    return fallback;
  }

  const base =
    Number(cost.bottleCost || 0) +
    Number(cost.printingCost || 0) +
    Number(cost.fruitCost || 0) +
    Number(cost.juiceCost || 0) +
    Number(cost.packagingCost || 0) +
    Number(cost.deliveryCost || 0) +
    Number(cost.otherCost || 0);

  return Math.round(
    base *
      (1 +
        Number(
          cost.wastagePercent || 0
        ) /
          100)
  );
}

function buildExpenseSummary(expenses) {
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

  return {
    totalAmount:
      Math.round(totalAmount),

    categoryTotals,
  };
}

function buildSalesReport({
  orders,
  fromDateId,
  toDateId,
  fallbackCostPerBottle,
  productCostMap,
  expenses,
}) {
  const productMap =
    new Map();

  const dateMap =
    new Map();

  const paymentSplit = {
    cod: {
      orderCount: 0,
      revenue: 0,
      bottles: 0,
    },

    online: {
      orderCount: 0,
      revenue: 0,
      bottles: 0,
    },
  };

  const expenseSummary =
    buildExpenseSummary(expenses);

  const summary = {
    orderCount: 0,
    activeOrderCount: 0,
    deliveredOrderCount: 0,
    cancelledOrderCount: 0,

    bottlesSold: 0,
    grossRevenue: 0,
    subtotalRevenue: 0,
    deliveryFeeRevenue: 0,
    couponDiscount: 0,

    codRevenue: 0,
    onlineRevenue: 0,

    codPendingAmount: 0,
    onlinePaidAmount: 0,

    cancelledValue: 0,
    refundedValue: 0,

    estimatedProductCost: 0,
    expenseTotal: expenseSummary.totalAmount,
    estimatedCost: 0,
    estimatedGrossProfit: 0,
  };

  for (const order of orders) {
    summary.orderCount += 1;

    const isCancelled =
      CANCELLED_STATUSES.includes(
        order.orderStatus
      );

    const isActiveSale =
      ACTIVE_SALES_STATUSES.includes(
        order.orderStatus
      );

    if (isCancelled) {
      summary.cancelledOrderCount += 1;
      summary.cancelledValue +=
        addMoney(order.total);

      if (
        order.refundStatus ===
          "processed" ||
        order.refundStatus ===
          "pending"
      ) {
        summary.refundedValue +=
          addMoney(
            order.refundAmount ||
              order.total
          );
      }

      continue;
    }

    if (!isActiveSale) {
      continue;
    }

    summary.activeOrderCount += 1;

    if (
      order.orderStatus ===
      "delivered"
    ) {
      summary.deliveredOrderCount += 1;
    }

    const total =
      addMoney(order.total);

    const subtotal =
      addMoney(order.subtotal);

    const deliveryFee =
      addMoney(order.deliveryFee);

    const discount =
      addMoney(order.couponDiscount);

    const orderDateId =
      getOrderDateId(order);

    if (!dateMap.has(orderDateId)) {
      dateMap.set(orderDateId, {
        dateId:
          orderDateId,

        orderCount: 0,
        bottlesSold: 0,
        revenue: 0,
        codRevenue: 0,
        onlineRevenue: 0,
      });
    }

    const dateRow =
      dateMap.get(orderDateId);

    dateRow.orderCount += 1;
    dateRow.revenue += total;

    summary.grossRevenue += total;
    summary.subtotalRevenue += subtotal;
    summary.deliveryFeeRevenue += deliveryFee;
    summary.couponDiscount += discount;

    const paymentMethod =
      order.paymentMethod === "online"
        ? "online"
        : "cod";

    paymentSplit[paymentMethod].orderCount += 1;
    paymentSplit[paymentMethod].revenue += total;

    if (paymentMethod === "cod") {
      summary.codRevenue += total;
      dateRow.codRevenue += total;

      if (
        order.paymentStatus !==
        "paid"
      ) {
        summary.codPendingAmount += total;
      }
    } else {
      summary.onlineRevenue += total;
      dateRow.onlineRevenue += total;

      if (
        order.paymentStatus === "paid"
      ) {
        summary.onlinePaidAmount += total;
      }
    }

    let orderBottleCount = 0;

    for (const item of order.items || []) {
      const quantity =
        Number(item.quantity || 0);

      if (
        !Number.isFinite(quantity) ||
        quantity <= 0
      ) {
        continue;
      }

      const productId =
        cleanText(item.productId) ||
        String(item.product || "");

      const unitCost =
        getCostTotal(
          productCostMap.get(productId),
          fallbackCostPerBottle
        );

      if (!productMap.has(productId)) {
        productMap.set(productId, {
          productId,

          name:
            item.name ||
            productId,

          shortName:
            item.shortName ||
            item.name ||
            productId,

          sizeMl:
            Number(item.sizeMl || 0),

          quantitySold: 0,
          revenue: 0,
          orderCount: 0,

          costPerBottle:
            unitCost,

          estimatedCost: 0,
          estimatedGrossProfit: 0,
        });
      }

      const itemValue =
        getItemValue(item);

      const productRow =
        productMap.get(productId);

      productRow.quantitySold += quantity;
      productRow.revenue += itemValue;
      productRow.orderCount += 1;
      productRow.estimatedCost +=
        quantity * unitCost;

      orderBottleCount += quantity;
      summary.estimatedProductCost +=
        quantity * unitCost;
    }

    summary.bottlesSold += orderBottleCount;
    dateRow.bottlesSold += orderBottleCount;
    paymentSplit[paymentMethod].bottles += orderBottleCount;
  }

  summary.estimatedCost =
    summary.estimatedProductCost +
    summary.expenseTotal;

  summary.estimatedGrossProfit =
    summary.grossRevenue -
    summary.estimatedCost;

  const productTotals =
    [...productMap.values()]
      .map((product) => ({
        ...product,

        estimatedCost:
          Math.round(
            product.estimatedCost
          ),

        estimatedGrossProfit:
          Math.round(
            product.revenue -
              product.estimatedCost
          ),
      }))
      .sort(
        (left, right) =>
          right.quantitySold -
            left.quantitySold ||
          right.revenue -
            left.revenue
      );

  const dateTotals =
    [...dateMap.values()].sort(
      (left, right) =>
        left.dateId.localeCompare(
          right.dateId
        )
    );

  const bestSellingProduct =
    productTotals[0] || null;

  return {
    fromDateId,
    toDateId,
    fallbackCostPerBottle,

    summary: {
      ...summary,

      grossRevenue:
        Math.round(
          summary.grossRevenue
        ),

      subtotalRevenue:
        Math.round(
          summary.subtotalRevenue
        ),

      deliveryFeeRevenue:
        Math.round(
          summary.deliveryFeeRevenue
        ),

      couponDiscount:
        Math.round(
          summary.couponDiscount
        ),

      codRevenue:
        Math.round(
          summary.codRevenue
        ),

      onlineRevenue:
        Math.round(
          summary.onlineRevenue
        ),

      codPendingAmount:
        Math.round(
          summary.codPendingAmount
        ),

      onlinePaidAmount:
        Math.round(
          summary.onlinePaidAmount
        ),

      cancelledValue:
        Math.round(
          summary.cancelledValue
        ),

      refundedValue:
        Math.round(
          summary.refundedValue
        ),

      estimatedProductCost:
        Math.round(
          summary.estimatedProductCost
        ),

      expenseTotal:
        Math.round(
          summary.expenseTotal
        ),

      estimatedCost:
        Math.round(
          summary.estimatedCost
        ),

      estimatedGrossProfit:
        Math.round(
          summary.estimatedGrossProfit
        ),
    },

    expenseSummary,

    bestSellingProduct,

    paymentSplit,

    productTotals,

    dateTotals,
  };
}

router.get(
  "/sales",
  async (req, res, next) => {
    try {
      const today =
        getDateIdInIst();

      const fromDateId =
        parseDateId(
          req.query.from,
          today
        );

      const toDateId =
        parseDateId(
          req.query.to,
          fromDateId
        );

      const fallbackValue =
        Number(req.query.costPerBottle);

      const fallbackCostPerBottle =
        Number.isFinite(
          fallbackValue
        ) &&
        fallbackValue >= 0
          ? fallbackValue
          : 30;

      const {
        from,
        toExclusive,
      } = createIstRange(
        fromDateId,
        toDateId
      );

      const [
        orders,
        productCosts,
        expenses,
      ] = await Promise.all([
        Order.find({
          createdAt: {
            $gte: from,
            $lt: toExclusive,
          },
        })
          .select(
            "orderNumber items subtotal deliveryFee couponDiscount total paymentMethod paymentStatus orderStatus refundStatus refundAmount createdAt"
          )
          .sort({
            createdAt: 1,
          })
          .lean(),

        ProductCost.find({}).lean(),

        BusinessExpense.find({
          expenseDateId: {
            $gte: fromDateId,
            $lte: toDateId,
          },
        }).lean(),
      ]);

      const productCostMap =
        new Map(
          productCosts.map(
            (cost) => [
              cost.productId,
              cost,
            ]
          )
        );

      const report =
        buildSalesReport({
          orders,
          fromDateId,
          toDateId,
          fallbackCostPerBottle,
          productCostMap,
          expenses,
        });

      return res.status(200).json({
        success: true,

        data: {
          report,
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);

module.exports = router;