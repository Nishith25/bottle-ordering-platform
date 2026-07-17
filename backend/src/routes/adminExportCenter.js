// backend/src/routes/adminExportCenter.js

const express = require("express");

const {
  protect,
  allowRoles,
} = require("../middleware/auth");

const CashCollection = require("../models/CashCollection");
const InventoryMovement = require("../models/InventoryMovement");
const Order = require("../models/Order");
const Product = require("../models/Product");
const User = require("../models/User");

const router = express.Router();

router.use(protect);
router.use(allowRoles("admin"));

const ORDER_STATUSES = [
  "placed",
  "confirmed",
  "preparing",
  "out_for_delivery",
  "delivered",
  "cancelled",
];

function cleanText(value) {
  return String(value ?? "").trim();
}

function escapeCsv(value) {
  const text = String(value ?? "");

  if (
    text.includes(",") ||
    text.includes('"') ||
    text.includes("\n")
  ) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function toCsv(headers, rows) {
  return [
    headers.map(escapeCsv).join(","),
    ...rows.map((row) =>
      row.map(escapeCsv).join(",")
    ),
  ].join("\n");
}

function sendCsv(res, filename, csv) {
  res.setHeader(
    "Content-Type",
    "text/csv; charset=utf-8"
  );

  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${filename}"`
  );

  return res.status(200).send(csv);
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

function parseDate(value) {
  const cleanValue =
    cleanText(value);

  if (!cleanValue) {
    return null;
  }

  const date =
    new Date(cleanValue);

  return Number.isNaN(
    date.getTime()
  )
    ? null
    : date;
}

function buildDateFilter({
  dateFrom,
  dateTo,
  field = "createdAt",
}) {
  const from =
    parseDate(dateFrom);

  const to =
    parseDate(dateTo);

  if (!from && !to) {
    return {};
  }

  const range = {};

  if (from) {
    range.$gte = from;
  }

  if (to) {
    const endDate =
      new Date(to);

    if (
      dateTo &&
      !String(dateTo).includes("T")
    ) {
      endDate.setHours(
        23,
        59,
        59,
        999
      );
    }

    range.$lte = endDate;
  }

  return {
    [field]: range,
  };
}

function getDayRangeInIndia(dateId) {
  return {
    start:
      new Date(`${dateId}T00:00:00.000+05:30`),

    end:
      new Date(`${dateId}T23:59:59.999+05:30`),
  };
}

function getCustomerName(order) {
  return (
    cleanText(order.customerSnapshot?.fullName) ||
    cleanText(order.customerSnapshot?.name) ||
    cleanText(order.deliveryAddress?.fullName) ||
    cleanText(order.deliveryAddress?.name) ||
    cleanText(order.user?.fullName) ||
    cleanText(order.user?.name) ||
    "Customer"
  );
}

function getCustomerPhone(order) {
  return (
    cleanText(order.deliveryAddress?.phone) ||
    cleanText(order.customerSnapshot?.phone) ||
    cleanText(order.user?.phone) ||
    cleanText(order.user?.mobile) ||
    ""
  );
}

function getBottleCount(order) {
  return Array.isArray(order.items)
    ? order.items.reduce(
        (total, item) =>
          total +
          Number(item.quantity || 0),
        0
      )
    : 0;
}

function getOrderItemsText(order) {
  return Array.isArray(order.items)
    ? order.items
        .map(
          (item) =>
            `${Number(item.quantity || 0)} x ${
              item.name ||
              item.productName ||
              item.shortName ||
              "Bottle"
            }`
        )
        .join("; ")
    : "";
}

function getAddressText(order) {
  const address =
    order.deliveryAddress || {};

  return [
    address.houseDetails,
    address.areaDetails,
    address.landmark
      ? `Landmark: ${address.landmark}`
      : "",
    address.area,
    address.city,
    address.pincode,
  ]
    .map(cleanText)
    .filter(Boolean)
    .join(", ");
}

function formatDate(value) {
  if (!value) {
    return "";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return date.toLocaleString(
    "en-IN",
    {
      timeZone:
        "Asia/Kolkata",
    }
  );
}

function sum(values) {
  return values.reduce(
    (total, value) =>
      total + Number(value || 0),
    0
  );
}

router.get(
  "/summary",
  async (req, res, next) => {
    try {
      const todayId =
        getDateIdInIndia();

      const dayRange =
        getDayRangeInIndia(todayId);

      const last24Hours =
        new Date(
          Date.now() -
            24 * 60 * 60 * 1000
        );

      const status =
        cleanText(req.query.status);

      const customerStatus =
        cleanText(req.query.customerStatus);

      const productId =
        cleanText(req.query.productId);

      const orderFilter = {
        ...buildDateFilter({
          dateFrom:
            req.query.dateFrom,
          dateTo:
            req.query.dateTo,
          field:
            "createdAt",
        }),
      };

      if (
        status &&
        status !== "all"
      ) {
        if (
          !ORDER_STATUSES.includes(
            status
          )
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid order status.",
          });
        }

        orderFilter.orderStatus =
          status;
      }

      const customerFilter = {
        role:
          "customer",
      };

      if (
        customerStatus === "active"
      ) {
        customerFilter.active = true;
      }

      if (
        customerStatus === "inactive"
      ) {
        customerFilter.active = false;
      }

      const inventoryFilter = {
        ...buildDateFilter({
          dateFrom:
            req.query.dateFrom,
          dateTo:
            req.query.dateTo,
          field:
            "createdAt",
        }),
      };

      if (productId) {
        inventoryFilter.productId =
          productId;
      }

      const [
        totalOrders,
        todayOrders,
        totalCustomers,
        products,
        pendingCodOrders,
        pendingCashHandover,
        inventoryMovements24h,
      ] = await Promise.all([
        Order.countDocuments(
          orderFilter
        ),

        Order.countDocuments({
          createdAt: {
            $gte:
              dayRange.start,
            $lte:
              dayRange.end,
          },
          ...(status &&
          status !== "all"
            ? {
                orderStatus:
                  status,
              }
            : {}),
        }),

        User.countDocuments(
          customerFilter
        ),

        Product.find({
          active: {
            $ne:
              false,
          },
        })
          .select(
            "stockQuantity lowStockThreshold active productId"
          )
          .lean(),

        Order.countDocuments({
          ...orderFilter,
          paymentMethod:
            "cod",
          paymentStatus: {
            $ne:
              "paid",
          },
          orderStatus: {
            $ne:
              "cancelled",
          },
        }),

        CashCollection.countDocuments({
          status: {
            $in: [
              "collected",
              "short_collected",
            ],
          },
          ...buildDateFilter({
            dateFrom:
              req.query.dateFrom,
            dateTo:
              req.query.dateTo,
            field:
              "createdAt",
          }),
        }),

        InventoryMovement.countDocuments({
          ...inventoryFilter,
          createdAt:
            inventoryFilter.createdAt || {
              $gte:
                last24Hours,
            },
        }),
      ]);

      const filteredProducts =
        productId
          ? products.filter(
              (product) =>
                product.productId ===
                productId
            )
          : products;

      const lowStockProducts =
        filteredProducts.filter(
          (product) =>
            Number(
              product.stockQuantity || 0
            ) <=
            Number(
              product.lowStockThreshold || 0
            )
        ).length;

      const outOfStockProducts =
        filteredProducts.filter(
          (product) =>
            Number(
              product.stockQuantity || 0
            ) <= 0
        ).length;

      return res.status(200).json({
        success: true,

        data: {
          summary: {
            totalOrders,
            todayOrders,
            totalCustomers,
            lowStockProducts,
            outOfStockProducts,
            pendingCodOrders,
            pendingCashHandover,
            inventoryMovements24h,
          },
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);

router.get(
  "/orders.csv",
  async (req, res, next) => {
    try {
      const status =
        cleanText(req.query.status);

      const filter = {
        ...buildDateFilter({
          dateFrom:
            req.query.dateFrom,
          dateTo:
            req.query.dateTo,
          field:
            "createdAt",
        }),
      };

      if (
        status &&
        status !== "all"
      ) {
        if (
          !ORDER_STATUSES.includes(
            status
          )
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid order status.",
          });
        }

        filter.orderStatus =
          status;
      }

      const orders =
        await Order.find(filter)
          .populate({
            path:
              "user",
            select:
              "fullName name email phone mobile role",
            options: {
              strictPopulate:
                false,
            },
          })
          .sort({
            createdAt: -1,
          })
          .limit(10000)
          .lean();

      const headers = [
        "Order Number",
        "Created At",
        "Customer Name",
        "Customer Phone",
        "Customer Email",
        "Order Status",
        "Delivery Status",
        "Payment Method",
        "Payment Status",
        "Refund Status",
        "Subtotal",
        "Delivery Fee",
        "Coupon Discount",
        "Total",
        "Bottle Count",
        "Delivery Date",
        "Delivery Slot",
        "Pincode",
        "Area",
        "City",
        "Address",
        "Items",
        "Cancellation Reason",
      ];

      const rows =
        orders.map((order) => [
          order.orderNumber,
          formatDate(order.createdAt),
          getCustomerName(order),
          getCustomerPhone(order),
          order.user?.email || "",
          order.orderStatus,
          order.deliveryStatus || "",
          order.paymentMethod,
          order.paymentStatus,
          order.refundStatus || "not_required",
          Number(order.subtotal || 0),
          Number(order.deliveryFee || 0),
          Number(order.couponDiscount || 0),
          Number(order.total || 0),
          getBottleCount(order),
          order.deliverySchedule?.deliveryDateLabel ||
            order.deliverySchedule?.deliveryDateId ||
            "",
          order.deliverySchedule?.deliverySlot ||
            order.deliverySchedule?.slotLabel ||
            "",
          order.deliveryAddress?.pincode || "",
          order.deliveryAddress?.area || "",
          order.deliveryAddress?.city || "",
          getAddressText(order),
          getOrderItemsText(order),
          order.cancellationReason || "",
        ]);

      const csv =
        toCsv(headers, rows);

      return sendCsv(
        res,
        `solidsip-orders-${getDateIdInIndia()}.csv`,
        csv
      );
    } catch (error) {
      return next(error);
    }
  }
);

router.get(
  "/cod.csv",
  async (req, res, next) => {
    try {
      const filter = {
        paymentMethod:
          "cod",
        orderStatus: {
          $ne:
            "cancelled",
        },
        ...buildDateFilter({
          dateFrom:
            req.query.dateFrom,
          dateTo:
            req.query.dateTo,
          field:
            "createdAt",
        }),
      };

      const orders =
        await Order.find(filter)
          .sort({
            createdAt: -1,
          })
          .limit(10000)
          .lean();

      const collections =
        await CashCollection.find({
          order: {
            $in:
              orders.map(
                (order) => order._id
              ),
          },
        })
          .sort({
            createdAt: -1,
          })
          .lean();

      const collectionMap =
        new Map(
          collections.map(
            (collection) => [
              String(collection.order),
              collection,
            ]
          )
        );

      const headers = [
        "Order Number",
        "Order Created At",
        "Customer Name",
        "Customer Phone",
        "Order Status",
        "Payment Status",
        "Order Total",
        "Collection Status",
        "Amount Due",
        "Amount Collected",
        "Collected At",
        "Collected By",
        "Handed Over At",
        "Handed Over By",
        "Notes",
      ];

      const rows =
        orders.map((order) => {
          const collection =
            collectionMap.get(
              String(order._id)
            );

          return [
            order.orderNumber,
            formatDate(order.createdAt),
            getCustomerName(order),
            getCustomerPhone(order),
            order.orderStatus,
            order.paymentStatus,
            Number(order.total || 0),
            collection?.status ||
              (order.paymentStatus ===
              "paid"
                ? "paid_without_collection_record"
                : "pending"),
            Number(
              collection?.amountDue ??
                order.total ??
                0
            ),
            Number(
              collection?.amountCollected ||
                0
            ),
            formatDate(
              collection?.collectedAt
            ),
            collection
              ?.collectedBySnapshot
              ?.fullName || "",
            formatDate(
              collection?.handedOverAt
            ),
            collection
              ?.handedOverBySnapshot
              ?.fullName || "",
            collection?.notes || "",
          ];
        });

      const csv =
        toCsv(headers, rows);

      return sendCsv(
        res,
        `solidsip-cod-${getDateIdInIndia()}.csv`,
        csv
      );
    } catch (error) {
      return next(error);
    }
  }
);

router.get(
  "/customers.csv",
  async (req, res, next) => {
    try {
      const status =
        cleanText(req.query.status);

      const filter = {
        role:
          "customer",
      };

      if (
        status === "active"
      ) {
        filter.active = true;
      }

      if (
        status === "inactive"
      ) {
        filter.active = false;
      }

      const users =
        await User.find(filter)
          .sort({
            createdAt: -1,
          })
          .limit(10000)
          .lean();

      const orderStats =
        await Order.aggregate([
          {
            $match: {
              user: {
                $in:
                  users.map(
                    (user) => user._id
                  ),
              },
            },
          },
          {
            $group: {
              _id:
                "$user",
              orderCount: {
                $sum:
                  1,
              },
              orderValue: {
                $sum: {
                  $cond: [
                    {
                      $ne: [
                        "$orderStatus",
                        "cancelled",
                      ],
                    },
                    "$total",
                    0,
                  ],
                },
              },
            },
          },
        ]);

      const statsMap =
        new Map(
          orderStats.map(
            (item) => [
              String(item._id),
              item,
            ]
          )
        );

      const headers = [
        "Customer ID",
        "Full Name",
        "Email",
        "Phone",
        "Active",
        "Email Verified",
        "Phone Verified",
        "Saved Addresses",
        "Order Count",
        "Order Value",
        "Last Login",
        "Created At",
      ];

      const rows =
        users.map((user) => {
          const stats =
            statsMap.get(
              String(user._id)
            );

          return [
            String(user._id),
            user.fullName || "",
            user.email || "",
            user.phone || "",
            user.active !== false
              ? "Yes"
              : "No",
            user.emailVerified
              ? "Yes"
              : "No",
            user.phoneVerified
              ? "Yes"
              : "No",
            Array.isArray(
              user.savedAddresses
            )
              ? user.savedAddresses.length
              : 0,
            stats?.orderCount || 0,
            stats?.orderValue || 0,
            formatDate(user.lastLoginAt),
            formatDate(user.createdAt),
          ];
        });

      const csv =
        toCsv(headers, rows);

      return sendCsv(
        res,
        `solidsip-customers-${getDateIdInIndia()}.csv`,
        csv
      );
    } catch (error) {
      return next(error);
    }
  }
);

router.get(
  "/inventory-movements.csv",
  async (req, res, next) => {
    try {
      const productId =
        cleanText(req.query.productId);

      const filter = {
        ...buildDateFilter({
          dateFrom:
            req.query.dateFrom,
          dateTo:
            req.query.dateTo,
          field:
            "createdAt",
        }),
      };

      if (productId) {
        filter.productId =
          productId;
      }

      const movements =
        await InventoryMovement.find(filter)
          .populate({
            path:
              "actor",
            select:
              "fullName email role",
            options: {
              strictPopulate:
                false,
            },
          })
          .sort({
            createdAt: -1,
          })
          .limit(10000)
          .lean();

      const headers = [
        "Created At",
        "Product ID",
        "Product Name",
        "Movement Type",
        "Direction",
        "Quantity Change",
        "Stock Before",
        "Stock After",
        "Threshold Before",
        "Threshold After",
        "Source",
        "Source Type",
        "Actor",
        "Actor Email",
        "Reason",
      ];

      const rows =
        movements.map(
          (movement) => [
            formatDate(
              movement.createdAt
            ),
            movement.productId || "",
            movement.productName || "",
            movement.movementType || "",
            movement.direction || "",
            Number(
              movement.quantityChange || 0
            ),
            Number(
              movement.stockBefore || 0
            ),
            Number(
              movement.stockAfter || 0
            ),
            Number(
              movement.lowStockThresholdBefore ||
                0
            ),
            Number(
              movement.lowStockThresholdAfter ||
                0
            ),
            movement.source || "",
            movement.sourceType || "",
            movement.actorSnapshot
              ?.fullName ||
              movement.actor?.fullName ||
              "",
            movement.actorSnapshot
              ?.email ||
              movement.actor?.email ||
              "",
            movement.reason || "",
          ]
        );

      const csv =
        toCsv(headers, rows);

      return sendCsv(
        res,
        `solidsip-inventory-movements-${getDateIdInIndia()}.csv`,
        csv
      );
    } catch (error) {
      return next(error);
    }
  }
);

router.get(
  "/low-stock.csv",
  async (req, res, next) => {
    try {
      const products =
        await Product.find({
          active: {
            $ne:
              false,
          },
        })
          .sort({
            name: 1,
          })
          .lean();

      const lowStock =
        products.filter(
          (product) =>
            Number(
              product.stockQuantity || 0
            ) <=
            Number(
              product.lowStockThreshold || 0
            )
        );

      const headers = [
        "Product ID",
        "Name",
        "Short Name",
        "Active",
        "Stock Quantity",
        "Low Stock Threshold",
        "Status",
        "Updated At",
      ];

      const rows =
        lowStock.map(
          (product) => [
            product.productId || "",
            product.name || "",
            product.shortName || "",
            product.active !== false
              ? "Yes"
              : "No",
            Number(
              product.stockQuantity || 0
            ),
            Number(
              product.lowStockThreshold || 0
            ),
            Number(
              product.stockQuantity || 0
            ) <= 0
              ? "Out of stock"
              : "Low stock",
            formatDate(product.updatedAt),
          ]
        );

      const csv =
        toCsv(headers, rows);

      return sendCsv(
        res,
        `solidsip-low-stock-${getDateIdInIndia()}.csv`,
        csv
      );
    } catch (error) {
      return next(error);
    }
  }
);

router.get(
  "/daily-closing.csv",
  async (req, res, next) => {
    try {
      const dateId =
        cleanText(req.query.date) ||
        getDateIdInIndia();

      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(
          dateId
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Please select a valid date.",
        });
      }

      const range =
        getDayRangeInIndia(dateId);

      const [
        createdOrders,
        deliveredOrders,
        codCollections,
        handedOverCollections,
        pendingCodOrders,
        failedRefundOrders,
      ] = await Promise.all([
        Order.find({
          createdAt: {
            $gte:
              range.start,
            $lte:
              range.end,
          },
          orderStatus: {
            $ne:
              "cancelled",
          },
        }).lean(),

        Order.find({
          orderStatus:
            "delivered",
          $or: [
            {
              deliveredAt: {
                $gte:
                  range.start,
                $lte:
                  range.end,
              },
            },
            {
              deliveryCompletedAt: {
                $gte:
                  range.start,
                $lte:
                  range.end,
              },
            },
          ],
        }).lean(),

        CashCollection.find({
          collectedAt: {
            $gte:
              range.start,
            $lte:
              range.end,
          },
        }).lean(),

        CashCollection.find({
          status:
            "handed_over",
          handedOverAt: {
            $gte:
              range.start,
            $lte:
              range.end,
          },
        }).lean(),

        Order.find({
          paymentMethod:
            "cod",
          paymentStatus: {
            $ne:
              "paid",
          },
          orderStatus: {
            $ne:
              "cancelled",
          },
        }).lean(),

        Order.find({
          refundStatus:
            "failed",
        }).lean(),
      ]);

      const headers = [
        "Date",
        "Orders Created",
        "Orders Delivered",
        "Sales Amount",
        "Bottles Sold",
        "COD Collected",
        "Cash Handed Over",
        "Pending COD Amount",
        "Pending COD Orders",
        "Failed Refund Count",
      ];

      const salesAmount =
        sum(
          createdOrders.map(
            (order) => order.total
          )
        );

      const bottlesSold =
        sum(
          createdOrders.map(
            getBottleCount
          )
        );

      const codCollected =
        sum(
          codCollections.map(
            (collection) =>
              collection.amountCollected
          )
        );

      const cashHandedOver =
        sum(
          handedOverCollections.map(
            (collection) =>
              collection.amountCollected
          )
        );

      const pendingCodAmount =
        sum(
          pendingCodOrders.map(
            (order) => order.total
          )
        );

      const rows = [
        [
          dateId,
          createdOrders.length,
          deliveredOrders.length,
          salesAmount,
          bottlesSold,
          codCollected,
          cashHandedOver,
          pendingCodAmount,
          pendingCodOrders.length,
          failedRefundOrders.length,
        ],
      ];

      const csv =
        toCsv(headers, rows);

      return sendCsv(
        res,
        `solidsip-daily-closing-${dateId}.csv`,
        csv
      );
    } catch (error) {
      return next(error);
    }
  }
);

module.exports = router;