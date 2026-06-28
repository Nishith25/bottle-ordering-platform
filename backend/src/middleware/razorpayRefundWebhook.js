const {
  applyRefundWebhook,
} = require(
  "../services/orderRefund"
);

const {
  verifyWebhookSignature,
} = require(
  "../services/razorpay"
);

async function razorpayRefundWebhookMiddleware(
  req,
  res,
  next
) {
  try {
    if (!Buffer.isBuffer(req.body)) {
      return next();
    }

    const signature = String(
      req.headers[
        "x-razorpay-signature"
      ] || ""
    );

    const signatureValid =
      verifyWebhookSignature(
        req.body,
        signature
      );

    if (!signatureValid) {
      return res.status(400).json({
        success: false,

        message:
          "Invalid Razorpay webhook signature.",
      });
    }

    const event = JSON.parse(
      req.body.toString("utf8")
    );

    if (
      [
        "refund.created",
        "refund.processed",
        "refund.failed",
      ].includes(event.event)
    ) {
      const refund =
        event?.payload?.refund
          ?.entity;

      if (refund) {
        await applyRefundWebhook({
          eventName: event.event,
          refund,
        });
      }
    }

    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports =
  razorpayRefundWebhookMiddleware;
