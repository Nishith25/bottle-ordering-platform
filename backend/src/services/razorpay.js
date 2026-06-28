// backend/src/services/razorpay.js

const crypto = require("crypto");
const Razorpay = require("razorpay");

let razorpayClient = null;

function createConfigurationError(message) {
  const error = new Error(message);
  error.statusCode = 503;

  return error;
}

function isRazorpayConfigured() {
  return Boolean(
    process.env.RAZORPAY_KEY_ID &&
      process.env.RAZORPAY_KEY_SECRET
  );
}

function getRazorpayClient() {
  if (!isRazorpayConfigured()) {
    throw createConfigurationError(
      "Razorpay is not configured on the backend."
    );
  }

  if (!razorpayClient) {
    razorpayClient = new Razorpay({
      key_id:
        process.env.RAZORPAY_KEY_ID,

      key_secret:
        process.env.RAZORPAY_KEY_SECRET,
    });
  }

  return razorpayClient;
}

function safeCompareHex(
  expected,
  received
) {
  if (
    typeof expected !== "string" ||
    typeof received !== "string"
  ) {
    return false;
  }

  const expectedBuffer =
    Buffer.from(expected, "hex");

  const receivedBuffer =
    Buffer.from(received, "hex");

  if (
    expectedBuffer.length === 0 ||
    expectedBuffer.length !==
      receivedBuffer.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    expectedBuffer,
    receivedBuffer
  );
}

function verifyPaymentSignature({
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
}) {
  const secret =
    process.env.RAZORPAY_KEY_SECRET;

  if (!secret) {
    throw createConfigurationError(
      "Razorpay payment verification is not configured."
    );
  }

  const expectedSignature =
    crypto
      .createHmac("sha256", secret)
      .update(
        `${razorpayOrderId}|${razorpayPaymentId}`
      )
      .digest("hex");

  return safeCompareHex(
    expectedSignature,
    razorpaySignature
  );
}

function verifyWebhookSignature(
  rawBody,
  receivedSignature
) {
  const webhookSecret =
    process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw createConfigurationError(
      "RAZORPAY_WEBHOOK_SECRET is missing."
    );
  }

  const expectedSignature =
    crypto
      .createHmac(
        "sha256",
        webhookSecret
      )
      .update(rawBody)
      .digest("hex");

  return safeCompareHex(
    expectedSignature,
    receivedSignature
  );
}

module.exports = {
  getRazorpayClient,
  isRazorpayConfigured,
  verifyPaymentSignature,
  verifyWebhookSignature,
};