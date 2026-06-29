const crypto = require("crypto");

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

function createHttpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function getDeliveryOtpSecret() {
  const secret =
    process.env.DELIVERY_OTP_SECRET ||
    process.env.JWT_SECRET;

  if (!secret) {
    throw createHttpError(
      "Delivery OTP security is not configured.",
      503
    );
  }

  return secret;
}

function createOtpSalt() {
  return crypto.randomBytes(18).toString("hex");
}

function deriveOtp(orderId, salt) {
  const digest = crypto
    .createHmac("sha256", getDeliveryOtpSecret())
    .update(`display:${orderId}:${salt}`)
    .digest();

  const numericValue = digest.readUInt32BE(0) % 10000;

  return String(numericValue).padStart(4, "0");
}

function hashOtp(orderId, salt, otp) {
  return crypto
    .createHmac("sha256", getDeliveryOtpSecret())
    .update(`verify:${orderId}:${salt}:${otp}`)
    .digest("hex");
}

function safeCompareHex(expected, received) {
  if (
    typeof expected !== "string" ||
    typeof received !== "string"
  ) {
    return false;
  }

  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(received, "hex");

  if (
    expectedBuffer.length === 0 ||
    expectedBuffer.length !== receivedBuffer.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    expectedBuffer,
    receivedBuffer
  );
}

function generateDeliveryOtp(order) {
  const salt = createOtpSalt();
  const otp = deriveOtp(order._id, salt);

  order.deliveryOtpSalt = salt;
  order.deliveryOtpHash = hashOtp(
    order._id,
    salt,
    otp
  );
  order.deliveryOtpGeneratedAt = new Date();
  order.deliveryOtpVerifiedAt = null;
  order.deliveryOtpAttempts = 0;
  order.deliveryOtpLockedUntil = null;

  return otp;
}

function getDeliveryOtp(order) {
  if (
    !order.deliveryOtpSalt ||
    !order.deliveryOtpHash
  ) {
    return "";
  }

  const otp = deriveOtp(
    order._id,
    order.deliveryOtpSalt
  );

  const expectedHash = hashOtp(
    order._id,
    order.deliveryOtpSalt,
    otp
  );

  if (
    !safeCompareHex(
      expectedHash,
      order.deliveryOtpHash
    )
  ) {
    throw createHttpError(
      "Delivery OTP data is invalid. Please ask support to reassign the delivery partner.",
      409
    );
  }

  return otp;
}

function normaliseOtp(value) {
  return String(value || "")
    .replace(/\D/g, "")
    .slice(0, 4);
}

function verifyDeliveryOtp(order, submittedOtp) {
  const now = new Date();

  if (
    order.deliveryOtpLockedUntil &&
    new Date(order.deliveryOtpLockedUntil).getTime() >
      now.getTime()
  ) {
    return {
      valid: false,
      locked: true,
      attemptsRemaining: 0,
    };
  }

  if (
    order.deliveryOtpLockedUntil &&
    new Date(order.deliveryOtpLockedUntil).getTime() <=
      now.getTime()
  ) {
    order.deliveryOtpAttempts = 0;
    order.deliveryOtpLockedUntil = null;
  }

  const otp = normaliseOtp(submittedOtp);

  if (otp.length !== 4) {
    order.deliveryOtpAttempts =
      Number(order.deliveryOtpAttempts || 0) + 1;
  } else {
    const submittedHash = hashOtp(
      order._id,
      order.deliveryOtpSalt,
      otp
    );

    if (
      safeCompareHex(
        order.deliveryOtpHash,
        submittedHash
      )
    ) {
      order.deliveryOtpAttempts = 0;
      order.deliveryOtpLockedUntil = null;
      order.deliveryOtpVerifiedAt = now;

      return {
        valid: true,
        locked: false,
        attemptsRemaining: MAX_ATTEMPTS,
      };
    }

    order.deliveryOtpAttempts =
      Number(order.deliveryOtpAttempts || 0) + 1;
  }

  const attemptsRemaining = Math.max(
    0,
    MAX_ATTEMPTS - order.deliveryOtpAttempts
  );

  if (attemptsRemaining === 0) {
    order.deliveryOtpLockedUntil = new Date(
      now.getTime() + LOCK_MINUTES * 60 * 1000
    );

    return {
      valid: false,
      locked: true,
      attemptsRemaining: 0,
    };
  }

  return {
    valid: false,
    locked: false,
    attemptsRemaining,
  };
}

module.exports = {
  MAX_ATTEMPTS,
  LOCK_MINUTES,
  generateDeliveryOtp,
  getDeliveryOtp,
  verifyDeliveryOtp,
};
