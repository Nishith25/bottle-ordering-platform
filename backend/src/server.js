require("dotenv").config();

const cors = require("cors");
const express = require("express");
const helmet = require("helmet");
const mongoose = require("mongoose");
const morgan = require("morgan");

const connectDB = require("./config/db");

const adminRoutes = require("./routes/admin");
const adminCouponRoutes = require("./routes/adminCoupons");
const adminDeliveryPartnerRoutes = require(
  "./routes/adminDeliveryPartners"
);
const adminDeliverySlotRoutes = require(
  "./routes/adminDeliverySlots"
);
const adminInventoryRoutes = require(
  "./routes/adminInventory"
);
const adminOrderRoutes = require(
  "./routes/adminOrders"
);
const adminSubscriptionChargeRoutes = require(
  "./routes/adminSubscriptionCharges"
);
const adminSubscriptionDetailsRoutes = require(
  "./routes/adminSubscriptionDetails"
);
const adminSubscriptionRoutes = require(
  "./routes/adminSubscriptions"
);
const adminUserRoutes = require(
  "./routes/adminUsers"
);

const authRoutes = require("./routes/auth");
const couponRoutes = require("./routes/coupons");
const deliveryOrderRoutes = require(
  "./routes/deliveryOrders"
);
const deliverySlotRoutes = require(
  "./routes/deliverySlots"
);
const locationRoutes = require("./routes/locations");
const notificationRoutes = require(
  "./routes/notifications"
);
const orderReviewRoutes = require(
  "./routes/orderReviews"
);
const orderRoutes = require("./routes/orders");
const productRoutes = require("./routes/products");
const pushTokenRoutes = require(
  "./routes/pushTokens"
);

const razorpaySubscriptionRoutes = require(
  "./routes/razorpaySubscriptions"
);
const razorpaySubscriptionWebhookRoutes = require(
  "./routes/razorpaySubscriptionWebhook"
);

const subscriptionDetailRoutes = require(
  "./routes/subscriptionDetails"
);
const subscriptionEditRoutes = require(
  "./routes/subscriptionEdits"
);
const subscriptionRoutes = require(
  "./routes/subscriptions"
);

const webPushSubscriptionRoutes = require(
  "./routes/webPushSubscriptions"
);

const razorpayRefundWebhookMiddleware = require(
  "./middleware/razorpayRefundWebhook"
);

const {
  router: razorpayPaymentRoutes,
  razorpayWebhookHandler,
  startPaymentExpiryWorker,
} = require("./routes/razorpayPayments");

const {
  ensureDefaultDeliverySlots,
} = require("./services/deliverySlotService");

const {
  startSubscriptionDeliveryWorker,
} = require("./services/subscriptionDelivery");

const {
  startPushReceiptWorker,
} = require("./services/pushNotificationService");

const app = express();

app.set("trust proxy", 1);
app.disable("x-powered-by");

const PORT = Number(
  process.env.PORT || 5001
);

const HOST = String(
  process.env.HOST || "0.0.0.0"
).trim();

/*
 * Normalises origins so these are treated equally:
 *
 * https://example.com
 * https://example.com/
 */
function normalizeOrigin(value) {
  return String(value || "")
    .trim()
    .replace(/\/+$/, "");
}

const configuredOrigins = String(
  process.env.CLIENT_ORIGINS || ""
)
  .split(",")
  .map(normalizeOrigin)
  .filter(Boolean);

const backendPublicOrigin = normalizeOrigin(
  process.env.BACKEND_PUBLIC_URL || ""
);

/*
 * BACKEND_PUBLIC_URL is added automatically because the
 * Razorpay checkout page is served from the backend itself
 * and calls /verify, /fail and /abandon from that origin.
 */
const allowedOrigins = [
  ...new Set([
    ...configuredOrigins,

    ...(backendPublicOrigin
      ? [backendPublicOrigin]
      : []),

    /*
     * Safe local development defaults.
     * These do not affect production security because they
     * only permit browser requests originating from these
     * exact local addresses.
     */
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:8081",
    "http://localhost:19006",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://127.0.0.1:8081",
    "http://127.0.0.1:19006",
  ]),
];

console.log(
  "Allowed CORS origins:",
  allowedOrigins
);

app.use(
  helmet({
    crossOriginOpenerPolicy: {
      policy:
        "same-origin-allow-popups",
    },

    /*
     * Razorpay Checkout loads external scripts and opens
     * secure payment windows. The dedicated checkout route
     * also removes CSP before sending its HTML.
     */
    crossOriginResourcePolicy: {
      policy: "cross-origin",
    },
  })
);

app.use(
  cors({
    origin(
      origin,
      callback
    ) {
      /*
       * Requests without an Origin header include:
       * - curl
       * - server-to-server calls
       * - native mobile requests
       * - Razorpay webhooks
       */
      if (!origin) {
        return callback(
          null,
          true
        );
      }

      const normalizedRequestOrigin =
        normalizeOrigin(origin);

      if (
        allowedOrigins.length ===
          0 ||
        allowedOrigins.includes(
          normalizedRequestOrigin
        )
      ) {
        return callback(
          null,
          true
        );
      }

      const error = new Error(
        `Origin ${normalizedRequestOrigin} is not permitted by CORS.`
      );

      error.statusCode = 403;

      return callback(
        error
      );
    },

    credentials: true,

    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
    ],

    exposedHeaders: [
      "Content-Length",
      "Content-Type",
    ],

    maxAge: 86400,
  })
);

/*
 * Raw webhook routes must remain before express.json().
 *
 * Razorpay signatures must be verified against the
 * unmodified request body.
 */
app.post(
  "/api/payments/razorpay/webhook",

  express.raw({
    type:
      "application/json",

    limit:
      "1mb",
  }),

  razorpayRefundWebhookMiddleware,

  razorpayWebhookHandler
);

app.use(
  "/api/webhooks/razorpay/subscriptions",

  razorpaySubscriptionWebhookRoutes
);

app.use(
  express.json({
    limit:
      "1mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "1mb",
  })
);

if (
  process.env.NODE_ENV !==
  "test"
) {
  app.use(
    morgan("dev")
  );
}

app.get(
  "/api/health",

  (
    req,
    res
  ) => {
    return res
      .status(200)
      .json({
        success: true,

        message:
          "Backend is running.",

        environment:
          process.env
            .NODE_ENV ||
          "development",

        host: HOST,
        port: PORT,

        backendPublicOrigin:
          backendPublicOrigin ||
          null,

        database:
          mongoose.connection
            .name ||
          null,

        databaseState:
          mongoose.connection
            .readyState,

        timestamp:
          new Date()
            .toISOString(),
      });
  }
);

app.use(
  "/api/auth",
  authRoutes
);

app.use(
  "/api/products",
  productRoutes
);

app.use(
  "/api/locations",
  locationRoutes
);

app.use(
  "/api/delivery-slots",
  deliverySlotRoutes
);

app.use(
  "/api/coupons",
  couponRoutes
);

app.use(
  "/api/orders",
  orderRoutes
);

app.use(
  "/api/order-reviews",
  orderReviewRoutes
);

app.use(
  "/api/notifications",
  notificationRoutes
);

app.use(
  "/api/push-tokens",
  pushTokenRoutes
);

app.use(
  "/api/web-push",
  webPushSubscriptionRoutes
);

app.use(
  "/api/subscriptions",
  razorpaySubscriptionRoutes
);

app.use(
  "/api/subscriptions",
  subscriptionDetailRoutes
);

app.use(
  "/api/subscriptions",
  subscriptionEditRoutes
);

app.use(
  "/api/subscriptions",
  subscriptionRoutes
);

app.use(
  "/api/payments/razorpay",
  razorpayPaymentRoutes
);

app.use(
  "/api/delivery/orders",
  deliveryOrderRoutes
);

app.use(
  "/api/admin/delivery-partners",
  adminDeliveryPartnerRoutes
);

app.use(
  "/api/admin/delivery-slots",
  adminDeliverySlotRoutes
);

app.use(
  "/api/admin/coupons",
  adminCouponRoutes
);

app.use(
  "/api/admin/orders",
  adminOrderRoutes
);

app.use(
  "/api/admin/subscription-charges",
  adminSubscriptionChargeRoutes
);

app.use(
  "/api/admin/subscriptions",
  adminSubscriptionDetailsRoutes
);

app.use(
  "/api/admin/subscriptions",
  adminSubscriptionRoutes
);

app.use(
  "/api/admin/users",
  adminUserRoutes
);

app.use(
  "/api/admin/inventory",
  adminInventoryRoutes
);

app.use(
  "/api/admin",
  adminRoutes
);

app.use(
  (
    req,
    res
  ) => {
    return res
      .status(404)
      .json({
        success: false,

        message:
          `Route not found: ${req.method} ${req.originalUrl}`,
      });
  }
);

app.use(
  (
    error,
    req,
    res,
    next
  ) => {
    console.error(
      error
    );

    if (
      error.code ===
      11000
    ) {
      const duplicateField =
        Object.keys(
          error.keyPattern ||
            {}
        )[0] ||
        "field";

      return res
        .status(409)
        .json({
          success: false,

          message:
            `A record already exists with this ${duplicateField}.`,
        });
    }

    const statusCode =
      error.statusCode ||
      (
        error.name ===
        "ValidationError"
          ? 400
          : 500
      );

    return res
      .status(
        statusCode
      )
      .json({
        success: false,

        message:
          statusCode ===
          500
            ? "An unexpected server error occurred."
            : error.message,

        ...(process.env
          .NODE_ENV ===
        "development"
          ? {
              stack:
                error.stack,
            }
          : {}),
      });
  }
);

async function startServer() {
  try {
    await connectDB();

    /*
     * Creates only missing default slots.
     * Existing admin configuration is preserved.
     */
    await ensureDefaultDeliverySlots();

    app.listen(
      PORT,
      HOST,

      () => {
        console.log(
          `Backend running on http://${HOST}:${PORT}`
        );

        console.log(
          `Local health: http://localhost:${PORT}/api/health`
        );

        if (
          backendPublicOrigin
        ) {
          console.log(
            `Public backend: ${backendPublicOrigin}`
          );
        }

        console.log(
          "For physical-device local testing, use your Mac Wi-Fi IP instead of localhost."
        );

        startPaymentExpiryWorker();
        startSubscriptionDeliveryWorker();
        startPushReceiptWorker();
      }
    );
  } catch (error) {
    console.error(
      "Unable to start backend:",

      error.message
    );

    process.exit(1);
  }
}

startServer();