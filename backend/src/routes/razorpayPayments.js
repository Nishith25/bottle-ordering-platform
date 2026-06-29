const crypto = require("crypto");
const express = require("express");
const mongoose = require("mongoose");

const { protect } = require("../middleware/auth");
const Order = require("../models/Order");
const PaymentSession = require("../models/PaymentSession");
const Product = require("../models/Product");

const {
  reserveProductInventory,
  restoreOrderInventory,
} = require("../services/inventory");

const {
  buildOrderDraft,
  createHttpError,
  createUniqueOrderNumber,
} = require("../services/orderCheckout");

const {
  redeemReservedCoupon,
  releaseCouponReservation,
  reserveCouponForPaymentSession,
} = require("../services/couponService");

const {
  getRazorpayClient,
  isRazorpayConfigured,
  verifyPaymentSignature,
  verifyWebhookSignature,
} = require("../services/razorpay");

const router = express.Router();

function hashSessionToken(token) {
  return crypto
    .createHash("sha256")
    .update(String(token || ""))
    .digest("hex");
}

function createSessionToken() {
  return crypto.randomBytes(32).toString("hex");
}

function getExpiryDate() {
  const configuredMinutes = Number(
    process.env.PAYMENT_SESSION_EXPIRY_MINUTES
  );

  const minutes =
    Number.isFinite(configuredMinutes) && configuredMinutes >= 10
      ? configuredMinutes
      : 20;

  return new Date(Date.now() + minutes * 60 * 1000);
}

function getCheckoutTimeoutSeconds() {
  const configuredSeconds = Number(
    process.env.RAZORPAY_CHECKOUT_TIMEOUT_SECONDS
  );

  if (
    Number.isInteger(configuredSeconds) &&
    configuredSeconds >= 300 &&
    configuredSeconds <= 1800
  ) {
    return configuredSeconds;
  }

  return 900;
}

function getBackendBaseUrl(req) {
  const configuredUrl = String(
    process.env.BACKEND_PUBLIC_URL || ""
  )
    .trim()
    .replace(/\/$/, "");

  if (configuredUrl) {
    return configuredUrl;
  }

  return `${req.protocol}://${req.get("host")}`;
}

function getAllowedOrigins() {
  return String(process.env.CLIENT_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function validateReturnUrl(value) {
  const returnUrl = String(value || "").trim();

  if (!returnUrl) {
    throw createHttpError("A payment return URL is required.");
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(returnUrl);
  } catch {
    throw createHttpError("The payment return URL is invalid.");
  }

  if (parsedUrl.protocol === "customerapp:") {
    return returnUrl;
  }

  if (
    process.env.NODE_ENV === "development" &&
    ["exp:", "exps:"].includes(parsedUrl.protocol)
  ) {
    return returnUrl;
  }

  if (
    ["http:", "https:"].includes(parsedUrl.protocol) &&
    getAllowedOrigins().includes(parsedUrl.origin)
  ) {
    return returnUrl;
  }

  throw createHttpError("The payment return URL is not allowed.");
}

function safeJson(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

async function restorePaymentSession(paymentSession, session) {
  await restoreOrderInventory({
    order: paymentSession,
    session,
  });
}

async function markPaymentSessionFailed({
  paymentSessionId,
  razorpayOrderId,
  reason,
  finalStatus = "failed",
}) {
  const mongoSession = await mongoose.startSession();

  try {
    await mongoSession.withTransaction(async () => {
      const filter = paymentSessionId
        ? { _id: paymentSessionId }
        : { razorpayOrderId };

      const paymentSession = await PaymentSession.findOne(filter).session(
        mongoSession
      );

      if (
        !paymentSession ||
        paymentSession.status === "paid" ||
        paymentSession.createdOrder
      ) {
        return;
      }

      await restorePaymentSession(paymentSession, mongoSession);

      await releaseCouponReservation({
        paymentSessionId: paymentSession._id,
        session: mongoSession,
      });

      paymentSession.status = finalStatus;
      paymentSession.failureReason = reason;
      paymentSession.failedAt = new Date();

      await paymentSession.save({ session: mongoSession });
    });
  } finally {
    await mongoSession.endSession();
  }
}

async function reserveRestoredInventory(paymentSession, session) {
  const items = paymentSession.orderDraft.items;
  const productIds = items.map((item) => item.product);

  const products = await Product.find({
    _id: { $in: productIds },
    available: true,
  })
    .session(session)
    .lean();

  if (products.length !== productIds.length) {
    throw createHttpError(
      "The payment was received, but one or more bottles are unavailable. Manual review is required.",
      409
    );
  }

  const quantitiesByProductId = new Map(
    items.map((item) => [item.productId, item.quantity])
  );

  await reserveProductInventory({
    products,
    quantitiesByProductId,
    session,
  });

  paymentSession.inventoryReserved = true;
  paymentSession.inventoryRestored = false;
  paymentSession.inventoryRestoredAt = null;
}

async function finalizePaymentSession({
  razorpayOrderId,
  razorpayPaymentId = "",
}) {
  const mongoSession = await mongoose.startSession();
  let completedOrder = null;

  try {
    await mongoSession.withTransaction(async () => {
      const paymentSession = await PaymentSession.findOne({
        razorpayOrderId,
      }).session(mongoSession);

      if (!paymentSession) {
        throw createHttpError("Payment session not found.", 404);
      }

      if (paymentSession.createdOrder) {
        completedOrder = await Order.findById(
          paymentSession.createdOrder
        ).session(mongoSession);
        return;
      }

      if (paymentSession.inventoryRestored) {
        await reserveRestoredInventory(paymentSession, mongoSession);
      }

      const orderNumber = await createUniqueOrderNumber(mongoSession);

      const orders = await Order.create(
        [
          {
            orderNumber,
            user: paymentSession.user,
            ...paymentSession.orderDraft,
            paymentMethod: "online",
            paymentGateway: "razorpay",
            paymentGatewayOrderId: paymentSession.razorpayOrderId,
            paymentStatus: "paid",
            paymentReference:
              razorpayPaymentId || paymentSession.razorpayPaymentId,
            paidAt: new Date(),
            orderStatus: "placed",
            refundStatus: "not_required",
            inventoryReserved: true,
            inventoryRestored: false,
          },
        ],
        { session: mongoSession }
      );

      completedOrder = orders[0];

      if (paymentSession.orderDraft?.coupon?.couponId) {
        const usage = await redeemReservedCoupon({
          paymentSessionId: paymentSession._id,
          orderId: completedOrder._id,
          session: mongoSession,
        });

        completedOrder.couponUsage = usage?._id || null;
        await completedOrder.save({ session: mongoSession });
      }

      paymentSession.status = "paid";
      paymentSession.razorpayPaymentId =
        razorpayPaymentId || paymentSession.razorpayPaymentId;
      paymentSession.createdOrder = completedOrder._id;
      paymentSession.paidAt = new Date();
      paymentSession.inventoryReserved = false;

      await paymentSession.save({ session: mongoSession });
    });

    return completedOrder;
  } finally {
    await mongoSession.endSession();
  }
}

async function ensurePaymentCaptured({ paymentSession, paymentId }) {
  const razorpay = getRazorpayClient();
  let payment = await razorpay.payments.fetch(paymentId);

  if (payment.order_id !== paymentSession.razorpayOrderId) {
    throw createHttpError(
      "The Razorpay payment does not belong to this order.",
      400
    );
  }

  if (Number(payment.amount) !== paymentSession.amountPaise) {
    throw createHttpError(
      "The Razorpay payment amount does not match this order.",
      400
    );
  }

  if (
    String(payment.currency).toUpperCase() !== paymentSession.currency
  ) {
    throw createHttpError(
      "The Razorpay payment currency does not match this order.",
      400
    );
  }

  if (payment.status === "authorized") {
    payment = await razorpay.payments.capture(
      paymentId,
      paymentSession.amountPaise,
      paymentSession.currency
    );
  }

  if (payment.status !== "captured" && payment.captured !== true) {
    throw createHttpError(
      "The payment has not been captured yet. Please wait and check again.",
      409
    );
  }

  return payment;
}

router.post("/initiate", protect, async (req, res, next) => {
  const mongoSession = await mongoose.startSession();
  let paymentSessionId = null;

  try {
    const returnUrl = validateReturnUrl(req.body.returnUrl);
    const razorpay = getRazorpayClient();
    const rawSessionToken = createSessionToken();
    const sessionTokenHash = hashSessionToken(rawSessionToken);
    let paymentSession = null;

    await mongoSession.withTransaction(async () => {
      const {
        draft,
        products,
        quantitiesByProductId,
      } = await buildOrderDraft(req.body, mongoSession, {
        userId: req.user._id,
      });

      await reserveProductInventory({
        products,
        quantitiesByProductId,
        session: mongoSession,
      });

      const expiresAt = getExpiryDate();

      const sessions = await PaymentSession.create(
        [
          {
            sessionTokenHash,
            user: req.user._id,
            status: "gateway_creating",
            returnUrl,
            prefill: {
              name: req.user.fullName,
              email: req.user.email,
              contact: req.user.phone,
            },
            amountPaise: Math.round(draft.total * 100),
            currency: "INR",
            orderDraft: draft,
            inventoryReserved: true,
            inventoryRestored: false,
            expiresAt,
          },
        ],
        { session: mongoSession }
      );

      paymentSession = sessions[0];
      paymentSessionId = paymentSession._id;

      if (draft.coupon?.couponId) {
        const usage = await reserveCouponForPaymentSession({
          couponSnapshot: draft.coupon,
          userId: req.user._id,
          paymentSessionId: paymentSession._id,
          expiresAt,
          session: mongoSession,
        });

        paymentSession.couponUsage = usage?._id || null;
        await paymentSession.save({ session: mongoSession });
      }
    });

    let razorpayOrder;

    try {
      razorpayOrder = await razorpay.orders.create({
        amount: paymentSession.amountPaise,
        currency: paymentSession.currency,
        receipt: `PS-${paymentSession._id}`,
        notes: {
          payment_session_id: String(paymentSession._id),
          user_id: String(req.user._id),
          coupon_code: paymentSession.orderDraft?.coupon?.code || "",
        },
      });
    } catch (gatewayError) {
      await markPaymentSessionFailed({
        paymentSessionId,
        reason: "Unable to create Razorpay order.",
      });

      gatewayError.statusCode = gatewayError.statusCode || 502;
      throw gatewayError;
    }

    paymentSession = await PaymentSession.findByIdAndUpdate(
      paymentSession._id,
      {
        $set: {
          status: "created",
          razorpayOrderId: razorpayOrder.id,
        },
      },
      { new: true }
    );

    const backendBaseUrl = getBackendBaseUrl(req);

    return res.status(201).json({
      success: true,
      message: "Razorpay Checkout is ready.",
      data: {
        paymentSession: {
          sessionToken: rawSessionToken,
          razorpayOrderId: razorpayOrder.id,
          amount: paymentSession.orderDraft.total,
          amountPaise: paymentSession.amountPaise,
          currency: paymentSession.currency,
          expiresAt: paymentSession.expiresAt,
          checkoutUrl: `${backendBaseUrl}/api/payments/razorpay/checkout/${rawSessionToken}`,
        },
      },
    });
  } catch (error) {
    if (paymentSessionId && !error.statusCode) {
      await markPaymentSessionFailed({
        paymentSessionId,
        reason: "Online payment setup failed.",
      });
    }

    return next(error);
  } finally {
    await mongoSession.endSession();
  }
});

router.get("/checkout/:sessionToken", async (req, res, next) => {
  try {
    const paymentSession = await PaymentSession.findOne({
      sessionTokenHash: hashSessionToken(req.params.sessionToken),
    }).lean();

    if (!paymentSession) {
      return res.status(404).send("Payment session not found.");
    }

    if (!["created", "abandoned"].includes(paymentSession.status)) {
      return res
        .status(410)
        .send("This payment session is no longer available.");
    }

    if (new Date(paymentSession.expiresAt).getTime() <= Date.now()) {
      await markPaymentSessionFailed({
        paymentSessionId: paymentSession._id,
        reason: "Payment session expired.",
        finalStatus: "expired",
      });

      return res.status(410).send("This payment session has expired.");
    }

    const checkoutData = {
      key: process.env.RAZORPAY_KEY_ID,
      amount: paymentSession.amountPaise,
      currency: paymentSession.currency,
      name: process.env.RAZORPAY_BUSINESS_NAME || "Fresh Bottle Store",
      description: paymentSession.orderDraft?.coupon?.code
        ? `Fresh bottle order · ${paymentSession.orderDraft.coupon.code}`
        : "Fresh bottle order",
      order_id: paymentSession.razorpayOrderId,
      prefill: paymentSession.prefill,
      timeout: getCheckoutTimeoutSeconds(),
      retry: { enabled: true, max_count: 2 },
      theme: { color: "#245C42" },
    };

    res.removeHeader("Content-Security-Policy");
    res.setHeader("Content-Type", "text/html; charset=utf-8");

    return res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Secure payment</title>
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; color: #203128; background: #f7f7f2; font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .card { width: min(420px, 100%); padding: 32px; border: 1px solid #e1e7df; border-radius: 28px; background: #fff; text-align: center; box-shadow: 0 24px 70px rgba(25,55,38,.1); }
    .icon { width: 68px; height: 68px; display: grid; place-items: center; margin: 0 auto; border-radius: 22px; color: #fff; background: #245c42; font-size: 28px; }
    h1 { margin: 22px 0 8px; font-size: 24px; }
    p { margin: 0; color: #718078; font-size: 14px; line-height: 1.6; }
    .coupon { margin-top: 10px; color: #245c42; font-weight: 800; }
    button { width: 100%; min-height: 52px; margin-top: 24px; border: 0; border-radius: 17px; color: #fff; background: #245c42; font-size: 14px; font-weight: 800; cursor: pointer; }
    button:disabled { opacity: .6; cursor: wait; }
    #status { min-height: 22px; margin-top: 16px; color: #5f6d65; font-size: 12px; }
  </style>
</head>
<body>
  <main class="card">
    <div class="icon">₹</div>
    <h1>Secure Razorpay Checkout</h1>
    <p>Amount payable: <strong>₹${paymentSession.orderDraft.total}</strong></p>
    ${
      paymentSession.orderDraft?.coupon?.code
        ? `<p class="coupon">${paymentSession.orderDraft.coupon.code} saved ₹${paymentSession.orderDraft.couponDiscount}</p>`
        : ""
    }
    <button id="pay-button" type="button">Pay securely</button>
    <div id="status">Opening payment options…</div>
  </main>
  <script>
    const checkoutOptions = ${safeJson(checkoutData)};
    const sessionToken = ${safeJson(req.params.sessionToken)};
    const returnUrl = ${safeJson(paymentSession.returnUrl)};
    const payButton = document.getElementById("pay-button");
    const statusElement = document.getElementById("status");
    let completed = false;

    function finish(parameters) {
      const target = new URL(returnUrl);
      Object.entries(parameters).forEach(([key, value]) => {
        target.searchParams.set(key, String(value || ""));
      });
      target.searchParams.set("session", sessionToken);
      window.location.replace(target.toString());
    }

    async function postJson(path, body) {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const payload = await response.json();
      if (!response.ok || payload.success === false) {
        throw new Error(payload.message || "Payment could not be verified.");
      }
      return payload;
    }

    checkoutOptions.handler = async function (response) {
      if (completed) return;
      completed = true;
      payButton.disabled = true;
      statusElement.textContent = "Verifying payment securely…";

      try {
        const result = await postJson("/api/payments/razorpay/verify", {
          sessionToken,
          razorpayPaymentId: response.razorpay_payment_id,
          razorpayOrderId: response.razorpay_order_id,
          razorpaySignature: response.razorpay_signature
        });
        finish({ status: "success", orderId: result.data.order._id });
      } catch (error) {
        completed = false;
        payButton.disabled = false;
        statusElement.textContent = error.message;
        finish({ status: "failed", message: error.message });
      }
    };

    checkoutOptions.modal = {
      ondismiss: async function () {
        if (completed) return;
        completed = true;
        try {
          await postJson("/api/payments/razorpay/abandon", { sessionToken });
        } catch {}
        finish({ status: "cancelled", message: "Payment was not completed." });
      }
    };

    const razorpayCheckout = new Razorpay(checkoutOptions);

    razorpayCheckout.on("payment.failed", async function (response) {
      if (completed) return;
      completed = true;
      const paymentId = response?.error?.metadata?.payment_id || "";
      const message = response?.error?.description || "Payment failed.";
      try {
        await postJson("/api/payments/razorpay/fail", {
          sessionToken,
          paymentId,
          reason: message
        });
      } catch {}
      finish({ status: "failed", message });
    });

    function openCheckout() {
      statusElement.textContent = "Complete payment in Razorpay Checkout.";
      razorpayCheckout.open();
    }

    payButton.addEventListener("click", openCheckout);
    window.addEventListener("load", openCheckout);
  </script>
</body>
</html>`);
  } catch (error) {
    return next(error);
  }
});

router.post("/verify", async (req, res, next) => {
  try {
    const sessionToken = String(req.body.sessionToken || "");
    const razorpayPaymentId = String(req.body.razorpayPaymentId || "");
    const razorpayOrderId = String(req.body.razorpayOrderId || "");
    const razorpaySignature = String(req.body.razorpaySignature || "");

    const paymentSession = await PaymentSession.findOne({
      sessionTokenHash: hashSessionToken(sessionToken),
    });

    if (!paymentSession) {
      throw createHttpError("Payment session not found.", 404);
    }

    if (razorpayOrderId !== paymentSession.razorpayOrderId) {
      throw createHttpError(
        "Razorpay order ID does not match this payment session."
      );
    }

    const signatureValid = verifyPaymentSignature({
      razorpayOrderId: paymentSession.razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    });

    if (!signatureValid) {
      throw createHttpError(
        "Razorpay payment signature verification failed.",
        400
      );
    }

    const payment = await ensurePaymentCaptured({
      paymentSession,
      paymentId: razorpayPaymentId,
    });

    const order = await finalizePaymentSession({
      razorpayOrderId: paymentSession.razorpayOrderId,
      razorpayPaymentId: payment.id,
    });

    return res.status(200).json({
      success: true,
      message: "Payment verified successfully.",
      data: { order },
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/fail", async (req, res, next) => {
  try {
    const paymentSession = await PaymentSession.findOne({
      sessionTokenHash: hashSessionToken(req.body.sessionToken),
    });

    if (!paymentSession) {
      throw createHttpError("Payment session not found.", 404);
    }

    const paymentId = String(req.body.paymentId || "");

    if (paymentId) {
      const razorpay = getRazorpayClient();
      const payment = await razorpay.payments.fetch(paymentId);

      if (payment.status === "captured" || payment.captured === true) {
        const order = await finalizePaymentSession({
          razorpayOrderId: paymentSession.razorpayOrderId,
          razorpayPaymentId: payment.id,
        });

        return res.status(200).json({
          success: true,
          data: { status: "paid", order },
        });
      }

      if (payment.status === "failed") {
        await markPaymentSessionFailed({
          paymentSessionId: paymentSession._id,
          reason: String(
            req.body.reason || "Razorpay payment failed."
          ),
        });

        return res.status(200).json({
          success: true,
          data: { status: "failed" },
        });
      }
    }

    paymentSession.status = "abandoned";
    paymentSession.abandonedAt = new Date();

    const shortExpiry = new Date(Date.now() + 5 * 60 * 1000);
    if (shortExpiry < paymentSession.expiresAt) {
      paymentSession.expiresAt = shortExpiry;
    }

    await paymentSession.save();

    return res.status(200).json({
      success: true,
      data: { status: "abandoned" },
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/abandon", async (req, res, next) => {
  try {
    const paymentSession = await PaymentSession.findOne({
      sessionTokenHash: hashSessionToken(req.body.sessionToken),
    });

    if (!paymentSession) {
      throw createHttpError("Payment session not found.", 404);
    }

    if (paymentSession.status === "paid") {
      return res.status(200).json({
        success: true,
        data: { status: "paid" },
      });
    }

    paymentSession.status = "abandoned";
    paymentSession.abandonedAt = new Date();

    const shortExpiry = new Date(Date.now() + 5 * 60 * 1000);
    if (shortExpiry < paymentSession.expiresAt) {
      paymentSession.expiresAt = shortExpiry;
    }

    await paymentSession.save();

    return res.status(200).json({
      success: true,
      message: "Payment session marked as abandoned.",
      data: { status: "abandoned" },
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/status/:sessionToken", protect, async (req, res, next) => {
  try {
    const paymentSession = await PaymentSession.findOne({
      sessionTokenHash: hashSessionToken(req.params.sessionToken),
      user: req.user._id,
    })
      .populate("createdOrder")
      .lean();

    if (!paymentSession) {
      throw createHttpError("Payment session not found.", 404);
    }

    return res.status(200).json({
      success: true,
      data: {
        status: paymentSession.status,
        order: paymentSession.createdOrder || null,
        message: paymentSession.failureReason || "",
      },
    });
  } catch (error) {
    return next(error);
  }
});

async function razorpayWebhookHandler(req, res, next) {
  try {
    const signature = String(
      req.headers["x-razorpay-signature"] || ""
    );

    if (!Buffer.isBuffer(req.body)) {
      return res.status(400).json({
        success: false,
        message: "Webhook raw body is unavailable.",
      });
    }

    const signatureValid = verifyWebhookSignature(req.body, signature);

    if (!signatureValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid Razorpay webhook signature.",
      });
    }

    const event = JSON.parse(req.body.toString("utf8"));
    const payment = event?.payload?.payment?.entity;
    const razorpayOrder = event?.payload?.order?.entity;
    const razorpayOrderId = payment?.order_id || razorpayOrder?.id || "";

    if (
      ["payment.captured", "order.paid"].includes(event.event) &&
      razorpayOrderId
    ) {
      const paymentSession = await PaymentSession.findOne({
        razorpayOrderId,
      });

      if (paymentSession) {
        if (
          payment &&
          Number(payment.amount) !== paymentSession.amountPaise
        ) {
          return res.status(400).json({
            success: false,
            message: "Webhook payment amount mismatch.",
          });
        }

        await finalizePaymentSession({
          razorpayOrderId,
          razorpayPaymentId: payment?.id || "",
        });
      }
    }

    if (event.event === "payment.failed" && razorpayOrderId) {
      await markPaymentSessionFailed({
        razorpayOrderId,
        reason:
          payment?.error_description || "Razorpay payment failed.",
      });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    return next(error);
  }
}

async function cleanupExpiredPaymentSessions() {
  if (!isRazorpayConfigured()) return;

  const expiredSessions = await PaymentSession.find({
    status: {
      $in: ["gateway_creating", "created", "abandoned"],
    },
    expiresAt: { $lte: new Date() },
  })
    .sort({ expiresAt: 1 })
    .limit(25);

  const razorpay = getRazorpayClient();

  for (const paymentSession of expiredSessions) {
    try {
      if (paymentSession.razorpayOrderId) {
        const gatewayOrder = await razorpay.orders.fetch(
          paymentSession.razorpayOrderId
        );

        if (
          gatewayOrder.status === "paid" ||
          Number(gatewayOrder.amount_paid) >= paymentSession.amountPaise
        ) {
          await finalizePaymentSession({
            razorpayOrderId: paymentSession.razorpayOrderId,
            razorpayPaymentId: paymentSession.razorpayPaymentId,
          });
          continue;
        }
      }

      await markPaymentSessionFailed({
        paymentSessionId: paymentSession._id,
        reason: "Payment session expired.",
        finalStatus: "expired",
      });
    } catch (error) {
      console.error(
        "Payment expiry reconciliation failed:",
        error.message
      );
    }
  }
}

function startPaymentExpiryWorker() {
  if (!isRazorpayConfigured()) {
    console.warn(
      "Razorpay expiry worker not started because Razorpay keys are missing."
    );
    return null;
  }

  const timer = setInterval(() => {
    void cleanupExpiredPaymentSessions();
  }, 60 * 1000);

  timer.unref?.();
  void cleanupExpiredPaymentSessions();
  return timer;
}

module.exports = {
  router,
  razorpayWebhookHandler,
  startPaymentExpiryWorker,
};
