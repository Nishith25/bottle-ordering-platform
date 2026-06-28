const crypto = require("crypto");
const https = require("https");
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

function getRazorpayRefundSpeed() {
  return String(
    process.env.RAZORPAY_REFUND_SPEED ||
      "normal"
  ).toLowerCase() === "optimum"
    ? "optimum"
    : "normal";
}

function getRazorpayErrorMessage(error) {
  return (
    error?.razorpayError?.error
      ?.description ||
    error?.error?.description ||
    error?.description ||
    error?.message ||
    "Razorpay could not complete the request."
  );
}

function requestRazorpayApi({
  method,
  path,
  body,
  headers = {},
}) {
  if (!isRazorpayConfigured()) {
    return Promise.reject(
      createConfigurationError(
        "Razorpay is not configured on the backend."
      )
    );
  }

  const keyId =
    process.env.RAZORPAY_KEY_ID;

  const keySecret =
    process.env.RAZORPAY_KEY_SECRET;

  const bodyText = body
    ? JSON.stringify(body)
    : "";

  const authorization =
    Buffer.from(
      `${keyId}:${keySecret}`
    ).toString("base64");

  return new Promise(
    (resolve, reject) => {
      const request = https.request(
        {
          protocol: "https:",
          hostname:
            "api.razorpay.com",
          port: 443,
          method,
          path,

          headers: {
            Accept:
              "application/json",

            Authorization:
              `Basic ${authorization}`,

            ...(bodyText
              ? {
                  "Content-Type":
                    "application/json",

                  "Content-Length":
                    Buffer.byteLength(
                      bodyText
                    ),
                }
              : {}),

            ...headers,
          },
        },
        (response) => {
          let responseText = "";

          response.setEncoding(
            "utf8"
          );

          response.on(
            "data",
            (chunk) => {
              responseText += chunk;
            }
          );

          response.on(
            "end",
            () => {
              let payload = {};

              if (responseText) {
                try {
                  payload = JSON.parse(
                    responseText
                  );
                } catch {
                  const error =
                    new Error(
                      "Razorpay returned an invalid response."
                    );

                  error.statusCode =
                    502;

                  reject(error);
                  return;
                }
              }

              const statusCode =
                Number(
                  response.statusCode ||
                    500
                );

              if (
                statusCode >= 200 &&
                statusCode < 300
              ) {
                resolve(payload);
                return;
              }

              const message =
                payload?.error
                  ?.description ||
                payload?.error
                  ?.reason ||
                payload?.message ||
                `Razorpay request failed with status ${statusCode}.`;

              const error =
                new Error(message);

              error.statusCode =
                statusCode;

              error.razorpayError =
                payload;

              reject(error);
            }
          );
        }
      );

      request.setTimeout(
        15000,
        () => {
          request.destroy(
            new Error(
              "Razorpay took too long to respond."
            )
          );
        }
      );

      request.on(
        "error",
        (error) => {
          reject(error);
        }
      );

      if (bodyText) {
        request.write(bodyText);
      }

      request.end();
    }
  );
}

async function createRazorpayRefund({
  paymentId,
  amountPaise,
  speed,
  notes,
  idempotencyKey,
}) {
  if (!paymentId) {
    const error = new Error(
      "A Razorpay payment ID is required for refund."
    );

    error.statusCode = 400;
    throw error;
  }

  if (
    !Number.isInteger(amountPaise) ||
    amountPaise < 100
  ) {
    const error = new Error(
      "Refund amount must be at least ₹1."
    );

    error.statusCode = 400;
    throw error;
  }

  if (
    !idempotencyKey ||
    idempotencyKey.length < 10
  ) {
    const error = new Error(
      "A valid refund idempotency key is required."
    );

    error.statusCode = 400;
    throw error;
  }

  return requestRazorpayApi({
    method: "POST",

    path:
      `/v1/payments/${encodeURIComponent(
        paymentId
      )}/refund`,

    headers: {
      "X-Refund-Idempotency":
        idempotencyKey,
    },

    body: {
      amount: amountPaise,
      speed,
      notes,
    },
  });
}

async function fetchRazorpayPayment(
  paymentId
) {
  return getRazorpayClient().payments.fetch(
    paymentId
  );
}

module.exports = {
  createRazorpayRefund,
  fetchRazorpayPayment,
  getRazorpayClient,
  getRazorpayErrorMessage,
  getRazorpayRefundSpeed,
  isRazorpayConfigured,
  verifyPaymentSignature,
  verifyWebhookSignature,
};
