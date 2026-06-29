const crypto = require("crypto");
const express = require("express");

const RazorpayWebhookEvent =
  require(
    "../models/RazorpayWebhookEvent"
  );

const {
  processSubscriptionChargedEvent,
  recordSubscriptionPaymentStateEvent,
} = require(
  "../services/subscriptionChargeProcessor"
);

const {
  syncMandateFromRazorpay,
  verifyWebhookSignature,
} = require(
  "../services/razorpaySubscriptionService"
);

const router = express.Router();

function getPayloadDigest(
  rawBody
) {
  return crypto
    .createHash("sha256")
    .update(rawBody)
    .digest("hex");
}

function getFallbackEventId(
  rawBody
) {
  return getPayloadDigest(
    rawBody
  );
}

router.post(
  "/",

  express.raw({
    type:
      "application/json",

    limit: "1mb",
  }),

  async (req, res) => {
    const rawBody =
      Buffer.isBuffer(
        req.body
      )
        ? req.body
        : Buffer.from(
            req.body || ""
          );

    const signature =
      req.get(
        "x-razorpay-signature"
      ) || "";

    const eventId =
      req.get(
        "x-razorpay-event-id"
      ) ||
      getFallbackEventId(
        rawBody
      );

    let eventRecord =
      null;

    try {
      const validSignature =
        verifyWebhookSignature({
          rawBody,

          signature,
        });

      if (!validSignature) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Invalid Razorpay webhook signature.",
          });
      }

      let payload;

      try {
        payload =
          JSON.parse(
            rawBody.toString(
              "utf8"
            )
          );
      } catch {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Invalid webhook JSON.",
          });
      }

      const eventType =
        String(
          payload.event ||
            "unknown"
        );

      const subscriptionEntity =
        payload?.payload
          ?.subscription
          ?.entity ||
        null;

      const paymentEntity =
        payload?.payload
          ?.payment
          ?.entity ||
        null;

      const payloadDigest =
        getPayloadDigest(
          rawBody
        );

      eventRecord =
        await RazorpayWebhookEvent.findOne(
          {
            eventId,
          }
        );

      if (
        eventRecord &&
        [
          "processed",
          "ignored",
        ].includes(
          eventRecord.processingStatus
        )
      ) {
        return res
          .status(200)
          .json({
            success: true,

            duplicate: true,

            eventId,
          });
      }

      if (!eventRecord) {
        try {
          eventRecord =
            await RazorpayWebhookEvent.create(
              {
                eventId,

                eventType,

                razorpaySubscriptionId:
                  subscriptionEntity
                    ?.id ||
                  "",

                razorpayPaymentId:
                  paymentEntity
                    ?.id ||
                  "",

                payloadDigest,

                processingStatus:
                  "processing",

                attempts: 1,

                receivedAt:
                  new Date(),
              }
            );
        } catch (error) {
          if (
            error.code ===
            11000
          ) {
            eventRecord =
              await RazorpayWebhookEvent.findOne(
                {
                  eventId,
                }
              );

            if (
              eventRecord &&
              [
                "processed",
                "ignored",
              ].includes(
                eventRecord.processingStatus
              )
            ) {
              return res
                .status(200)
                .json({
                  success:
                    true,

                  duplicate:
                    true,

                  eventId,
                });
            }
          } else {
            throw error;
          }
        }
      }

      if (eventRecord) {
        eventRecord.eventType =
          eventType;

        eventRecord.razorpaySubscriptionId =
          subscriptionEntity
            ?.id ||
          "";

        eventRecord.razorpayPaymentId =
          paymentEntity
            ?.id ||
          "";

        eventRecord.payloadDigest =
          payloadDigest;

        eventRecord.processingStatus =
          "processing";

        eventRecord.attempts =
          Math.max(
            1,
            Number(
              eventRecord.attempts ||
                0
            ) + 1
          );

        eventRecord.errorMessage =
          "";

        await eventRecord.save();
      }

      if (
        !subscriptionEntity?.id
      ) {
        if (eventRecord) {
          eventRecord.processingStatus =
            "ignored";

          eventRecord.errorMessage =
            "The webhook did not include a subscription entity.";

          eventRecord.processedAt =
            new Date();

          await eventRecord.save();
        }

        return res
          .status(200)
          .json({
            success: true,

            ignored: true,

            eventId,
          });
      }

      const mandate =
        await syncMandateFromRazorpay(
          {
            subscriptionEntity,

            paymentEntity,

            eventId,

            eventType,
          }
        );

      if (!mandate) {
        if (eventRecord) {
          eventRecord.processingStatus =
            "ignored";

          eventRecord.errorMessage =
            "No matching local Razorpay mandate was found.";

          eventRecord.processedAt =
            new Date();

          await eventRecord.save();
        }

        return res
          .status(200)
          .json({
            success: true,

            ignored: true,

            eventId,
          });
      }

      let processingResult = {
        status:
          "mandate_synced",
      };

      if (
        eventType ===
        "subscription.charged"
      ) {
        if (
          !paymentEntity?.id
        ) {
          throw new Error(
            "subscription.charged did not include a payment entity."
          );
        }

        processingResult =
          await processSubscriptionChargedEvent(
            {
              eventId,

              eventType,

              subscriptionEntity,

              paymentEntity,
            }
          );
      }

      if (
        [
          "subscription.pending",
          "subscription.halted",
        ].includes(
          eventType
        )
      ) {
        processingResult =
          await recordSubscriptionPaymentStateEvent(
            {
              eventId,

              eventType,

              subscriptionEntity,

              paymentEntity,
            }
          );
      }

      if (eventRecord) {
        eventRecord.processingStatus =
          "processed";

        eventRecord.errorMessage =
          processingResult
            ?.reason ||
          "";

        eventRecord.processedAt =
          new Date();

        await eventRecord.save();
      }

      return res
        .status(200)
        .json({
          success: true,

          eventId,

          eventType,

          data: {
            result:
              processingResult,
          },
        });
    } catch (error) {
      console.error(
        "Razorpay subscription webhook error:",
        error
      );

      try {
        await RazorpayWebhookEvent.findOneAndUpdate(
          {
            eventId,
          },

          {
            $set: {
              processingStatus:
                "failed",

              errorMessage:
                error.message ||
                "Webhook processing failed.",
            },

            $setOnInsert: {
              eventType:
                "unknown",

              payloadDigest:
                getPayloadDigest(
                  rawBody
                ),

              attempts: 1,

              receivedAt:
                new Date(),
            },
          },

          {
            upsert: true,
          }
        );
      } catch (
        databaseError
      ) {
        console.error(
          "Unable to record webhook failure:",
          databaseError
        );
      }

      return res
        .status(
          error.statusCode ||
            500
        )
        .json({
          success: false,

          message:
            error.message ||
            "Webhook processing failed.",
        });
    }
  }
);

module.exports = router;