const crypto = require("crypto");
const https = require("https");

const RazorpayPlanMapping = require(
  "../models/RazorpayPlanMapping"
);

const RazorpaySubscriptionMandate =
  require(
    "../models/RazorpaySubscriptionMandate"
  );

const Subscription = require(
  "../models/Subscription"
);

const TERMINAL_STATUSES = [
  "cancelled",
  "completed",
  "expired",
];

function createHttpError(
  message,
  statusCode = 400
) {
  const error = new Error(message);

  error.statusCode = statusCode;

  return error;
}

function cleanText(value) {
  return String(
    value ?? ""
  ).trim();
}

function getRazorpayCredentials() {
  const keyId =
    cleanText(
      process.env.RAZORPAY_KEY_ID
    );

  const keySecret =
    cleanText(
      process.env
        .RAZORPAY_KEY_SECRET
    );

  if (!keyId || !keySecret) {
    throw createHttpError(
      "Razorpay API credentials are not configured.",
      503
    );
  }

  return {
    keyId,
    keySecret,
  };
}

function toPaise(value) {
  const amount =
    Number(value);

  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    throw createHttpError(
      "The subscription amount is invalid."
    );
  }

  const amountPaise =
    Math.round(amount * 100);

  if (amountPaise < 100) {
    throw createHttpError(
      "The Razorpay plan amount must be at least ₹1."
    );
  }

  return amountPaise;
}

function unixToDate(value) {
  const numericValue =
    Number(value);

  if (
    !Number.isFinite(
      numericValue
    ) ||
    numericValue <= 0
  ) {
    return null;
  }

  return new Date(
    numericValue * 1000
  );
}

function getBillingConfiguration(
  billingCycle
) {
  if (
    billingCycle ===
    "weekly"
  ) {
    return {
      period: "weekly",
      interval: 1,

      totalCount:
        Math.max(
          1,
          Number(
            process.env
              .RAZORPAY_WEEKLY_TOTAL_COUNT ||
              52
          )
        ),
    };
  }

  if (
    billingCycle ===
    "monthly"
  ) {
    return {
      period: "monthly",
      interval: 1,

      totalCount:
        Math.max(
          1,
          Number(
            process.env
              .RAZORPAY_MONTHLY_TOTAL_COUNT ||
              12
          )
        ),
    };
  }

  throw createHttpError(
    "Only weekly and monthly subscriptions are supported."
  );
}

function getStartTimestamp(
  nextBillingAt
) {
  const requestedDate =
    new Date(nextBillingAt);

  const minimumStart =
    Date.now() +
    15 * 60 * 1000;

  if (
    Number.isNaN(
      requestedDate.getTime()
    ) ||
    requestedDate.getTime() <
      minimumStart
  ) {
    return Math.floor(
      minimumStart / 1000
    );
  }

  return Math.floor(
    requestedDate.getTime() /
      1000
  );
}

function buildPlanMappingKey({
  billingCycle,
  amountPaise,
  currency,
}) {
  return [
    billingCycle,
    amountPaise,
    currency,
  ].join(":");
}

function razorpayRequest(
  path,
  {
    method = "GET",
    body = null,
  } = {}
) {
  const {
    keyId,
    keySecret,
  } = getRazorpayCredentials();

  const requestBody =
    body === null
      ? ""
      : JSON.stringify(body);

  const authorization =
    Buffer.from(
      `${keyId}:${keySecret}`
    ).toString("base64");

  return new Promise(
    (resolve, reject) => {
      const request =
        https.request(
          {
            hostname:
              "api.razorpay.com",

            port: 443,

            path:
              `/v1${path}`,

            method,

            headers: {
              Accept:
                "application/json",

              Authorization:
                `Basic ${authorization}`,

              ...(requestBody
                ? {
                    "Content-Type":
                      "application/json",

                    "Content-Length":
                      Buffer.byteLength(
                        requestBody
                      ),
                  }
                : {}),
            },
          },

          (response) => {
            let responseBody =
              "";

            response.setEncoding(
              "utf8"
            );

            response.on(
              "data",
              (chunk) => {
                responseBody +=
                  chunk;
              }
            );

            response.on(
              "end",
              () => {
                let payload = {};

                try {
                  payload =
                    responseBody
                      ? JSON.parse(
                          responseBody
                        )
                      : {};
                } catch {
                  const error =
                    createHttpError(
                      "Razorpay returned an invalid response.",
                      502
                    );

                  return reject(
                    error
                  );
                }

                const statusCode =
                  response.statusCode ||
                  500;

                if (
                  statusCode < 200 ||
                  statusCode >= 300
                ) {
                  const providerMessage =
                    payload?.error
                      ?.description ||
                    payload?.error
                      ?.reason ||
                    payload?.error
                      ?.code ||
                    payload?.message ||
                    "Razorpay rejected the request.";

                  const error =
                    createHttpError(
                      providerMessage,
                      statusCode >= 500
                        ? 502
                        : 400
                    );

                  error.providerStatus =
                    statusCode;

                  error.providerPayload =
                    payload;

                  return reject(
                    error
                  );
                }

                return resolve(
                  payload
                );
              }
            );
          }
        );

      request.on(
        "error",
        (requestError) => {
          const error =
            createHttpError(
              `Unable to connect to Razorpay: ${requestError.message}`,
              502
            );

          reject(error);
        }
      );

      request.setTimeout(
        20000,
        () => {
          request.destroy();

          reject(
            createHttpError(
              "Razorpay took too long to respond.",
              504
            )
          );
        }
      );

      if (requestBody) {
        request.write(
          requestBody
        );
      }

      request.end();
    }
  );
}

async function getOrCreateRazorpayPlan({
  billingCycle,
  amountPaise,
  planName,
}) {
  const currency = "INR";

  const configuration =
    getBillingConfiguration(
      billingCycle
    );

  const mappingKey =
    buildPlanMappingKey({
      billingCycle,
      amountPaise,
      currency,
    });

  const existingMapping =
    await RazorpayPlanMapping.findOne(
      {
        mappingKey,
        active: true,
      }
    ).lean();

  if (existingMapping) {
    return existingMapping;
  }

  const razorpayPlan =
    await razorpayRequest(
      "/plans",
      {
        method: "POST",

        body: {
          period:
            configuration.period,

          interval:
            configuration.interval,

          item: {
            name:
              `${planName} - ${billingCycle}`.slice(
                0,
                120
              ),

            amount:
              amountPaise,

            currency,

            description:
              "Fresh bottle subscription cycle",
          },

          notes: {
            application:
              "bottle-ordering-platform",

            billing_cycle:
              billingCycle,

            amount_paise:
              String(
                amountPaise
              ),
          },
        },
      }
    );

  try {
    return await RazorpayPlanMapping.create(
      {
        mappingKey,

        razorpayPlanId:
          razorpayPlan.id,

        billingCycle,

        period:
          configuration.period,

        interval:
          configuration.interval,

        amountPaise,

        currency,

        itemName:
          `${planName} - ${billingCycle}`,

        active: true,
      }
    );
  } catch (error) {
    if (
      error.code === 11000
    ) {
      const mapping =
        await RazorpayPlanMapping.findOne(
          {
            mappingKey,
          }
        );

      if (mapping) {
        return mapping;
      }
    }

    throw error;
  }
}

async function fetchRazorpaySubscription(
  razorpaySubscriptionId
) {
  if (
    !cleanText(
      razorpaySubscriptionId
    )
  ) {
    throw createHttpError(
      "Razorpay subscription ID is missing."
    );
  }

  return razorpayRequest(
    `/subscriptions/${encodeURIComponent(
      razorpaySubscriptionId
    )}`
  );
}

async function syncMandateFromRazorpay({
  subscriptionEntity,
  paymentEntity = null,
  eventId = "",
  eventType = "",
}) {
  if (
    !subscriptionEntity?.id
  ) {
    throw createHttpError(
      "The Razorpay subscription payload is invalid."
    );
  }

  const update = {
    razorpayPlanId:
      subscriptionEntity.plan_id,

    razorpayCustomerId:
      subscriptionEntity.customer_id ||
      "",

    shortUrl:
      subscriptionEntity.short_url ||
      "",

    status:
      subscriptionEntity.status ||
      "unknown",

    totalCount:
      Number(
        subscriptionEntity.total_count ||
          1
      ),

    paidCount:
      Number(
        subscriptionEntity.paid_count ||
          0
      ),

    remainingCount:
      Number(
        subscriptionEntity.remaining_count ||
          0
      ),

    authAttempts:
      Number(
        subscriptionEntity.auth_attempts ||
          0
      ),

    startAt:
      unixToDate(
        subscriptionEntity.start_at
      ),

    chargeAt:
      unixToDate(
        subscriptionEntity.charge_at
      ),

    currentStart:
      unixToDate(
        subscriptionEntity.current_start
      ),

    currentEnd:
      unixToDate(
        subscriptionEntity.current_end
      ),

    endedAt:
      unixToDate(
        subscriptionEntity.ended_at
      ),

    paymentMethod:
      subscriptionEntity.payment_method ||
      "",

    lastWebhookEventId:
      eventId,

    lastWebhookEventType:
      eventType,

    lastWebhookAt:
      eventType
        ? new Date()
        : undefined,
  };

  if (paymentEntity) {
    update.lastPaymentId =
      paymentEntity.id ||
      "";

    update.lastPaymentStatus =
      paymentEntity.status ||
      "";

    update.lastPaymentAmountPaise =
      Number(
        paymentEntity.amount ||
          0
      );

    update.lastPaymentAt =
      unixToDate(
        paymentEntity.created_at
      ) ||
      new Date();

    update.lastPaymentFailureReason =
      paymentEntity.error_description ||
      paymentEntity.error_reason ||
      "";
  }

  Object.keys(update).forEach(
    (key) => {
      if (
        update[key] ===
        undefined
      ) {
        delete update[key];
      }
    }
  );

  const mandate =
    await RazorpaySubscriptionMandate.findOneAndUpdate(
      {
        razorpaySubscriptionId:
          subscriptionEntity.id,
      },

      {
        $set: update,
      },

      {
        new: true,
      }
    );

  if (!mandate) {
    return null;
  }

  const localUpdate = {
    paymentReference:
      subscriptionEntity.id,
  };

  /*
   * Keep mandate_pending for authenticated/active
   * Razorpay subscriptions during Phase 1.
   *
   * This prevents the existing date-based worker
   * from generating an order before we connect
   * subscription.charged events in Phase 2.
   */
  if (
    [
      "created",
      "authenticated",
      "active",
      "paused",
    ].includes(
      subscriptionEntity.status
    )
  ) {
    localUpdate.paymentStatus =
      "mandate_pending";
  }

  if (
    [
      "pending",
      "halted",
    ].includes(
      subscriptionEntity.status
    )
  ) {
    localUpdate.paymentStatus =
      "failed";
  }

  if (
    subscriptionEntity.status ===
    "cancelled"
  ) {
    localUpdate.paymentStatus =
      "cancelled";

    localUpdate.status =
      "cancelled";

    localUpdate.cancelledAt =
      new Date();

    mandate.cancelledAt =
      mandate.cancelledAt ||
      new Date();

    await mandate.save();
  }

  if (
    [
      "completed",
      "expired",
    ].includes(
      subscriptionEntity.status
    )
  ) {
    localUpdate.status =
      "expired";
  }

  await Subscription.findByIdAndUpdate(
    mandate.localSubscription,
    {
      $set:
        localUpdate,
    }
  );

  return mandate;
}

async function prepareRazorpaySubscription({
  localSubscription,
  user,
}) {
  if (!localSubscription) {
    throw createHttpError(
      "Subscription not found.",
      404
    );
  }

  if (
    [
      "cancelled",
      "expired",
    ].includes(
      localSubscription.status
    )
  ) {
    throw createHttpError(
      "This subscription cannot create a new payment mandate.",
      409
    );
  }

  const amountPaise =
    toPaise(
      localSubscription.totalPerCycle
    );

  const existingMandate =
    await RazorpaySubscriptionMandate.findOne(
      {
        localSubscription:
          localSubscription._id,

        status: {
          $nin:
            TERMINAL_STATUSES,
        },
      }
    ).sort({
      createdAt: -1,
    });

  if (existingMandate) {
    if (
      existingMandate.amountPaise !==
        amountPaise ||
      existingMandate.billingCycle !==
        localSubscription.billingCycle
    ) {
      throw createHttpError(
        "The subscription price or billing cycle changed after the Razorpay mandate was created. Cancel the existing test mandate before creating another one.",
        409
      );
    }

    try {
      const remoteSubscription =
        await fetchRazorpaySubscription(
          existingMandate.razorpaySubscriptionId
        );

      await syncMandateFromRazorpay(
        {
          subscriptionEntity:
            remoteSubscription,
        }
      );
    } catch (error) {
      console.error(
        "Unable to refresh existing Razorpay subscription:",
        error.message
      );
    }

    return {
      mandate:
        await RazorpaySubscriptionMandate.findById(
          existingMandate._id
        ).lean(),

      checkout: {
        keyId:
          getRazorpayCredentials()
            .keyId,

        razorpaySubscriptionId:
          existingMandate.razorpaySubscriptionId,

        shortUrl:
          existingMandate.shortUrl,

        amountPaise:
          existingMandate.amountPaise,

        currency:
          existingMandate.currency,

        name:
          "Bottle Subscription",

        description:
          localSubscription.planName,

        prefill: {
          name:
            user?.fullName ||
            localSubscription
              .deliveryAddress
              ?.fullName ||
            "",

          email:
            user?.email ||
            "",

          contact:
            user?.phone ||
            localSubscription
              .deliveryAddress
              ?.phone ||
            "",
        },
      },
    };
  }

  const planMapping =
    await getOrCreateRazorpayPlan(
      {
        billingCycle:
          localSubscription.billingCycle,

        amountPaise,

        planName:
          localSubscription.planName,
      }
    );

  const configuration =
    getBillingConfiguration(
      localSubscription.billingCycle
    );

  const startAt =
    getStartTimestamp(
      localSubscription.nextBillingAt
    );

  const remoteSubscription =
    await razorpayRequest(
      "/subscriptions",
      {
        method: "POST",

        body: {
          plan_id:
            planMapping.razorpayPlanId,

          total_count:
            configuration.totalCount,

          quantity: 1,

          customer_notify:
            false,

          start_at:
            startAt,

          notes: {
            local_subscription_id:
              String(
                localSubscription._id
              ),

            subscription_number:
              localSubscription.subscriptionNumber,

            user_id:
              String(
                localSubscription.user
              ),

            plan_name:
              localSubscription.planName.slice(
                0,
                200
              ),
          },
        },
      }
    );

  const mandate =
    await RazorpaySubscriptionMandate.create(
      {
        localSubscription:
          localSubscription._id,

        user:
          localSubscription.user,

        subscriptionNumber:
          localSubscription.subscriptionNumber,

        planName:
          localSubscription.planName,

        billingCycle:
          localSubscription.billingCycle,

        amountPaise,

        currency:
          "INR",

        razorpayPlanId:
          planMapping.razorpayPlanId,

        razorpaySubscriptionId:
          remoteSubscription.id,

        razorpayCustomerId:
          remoteSubscription.customer_id ||
          "",

        shortUrl:
          remoteSubscription.short_url ||
          "",

        status:
          remoteSubscription.status ||
          "created",

        totalCount:
          remoteSubscription.total_count ||
          configuration.totalCount,

        paidCount:
          remoteSubscription.paid_count ||
          0,

        remainingCount:
          remoteSubscription.remaining_count ||
          configuration.totalCount,

        authAttempts:
          remoteSubscription.auth_attempts ||
          0,

        startAt:
          unixToDate(
            remoteSubscription.start_at
          ),

        chargeAt:
          unixToDate(
            remoteSubscription.charge_at
          ),
      }
    );

  await Subscription.findByIdAndUpdate(
    localSubscription._id,
    {
      $set: {
        paymentStatus:
          "mandate_pending",

        paymentReference:
          remoteSubscription.id,
      },
    }
  );

  return {
    mandate:
      mandate.toObject(),

    checkout: {
      keyId:
        getRazorpayCredentials()
          .keyId,

      razorpaySubscriptionId:
        remoteSubscription.id,

      shortUrl:
        remoteSubscription.short_url ||
        "",

      amountPaise,

      currency:
        "INR",

      name:
        "Bottle Subscription",

      description:
        localSubscription.planName,

      prefill: {
        name:
          user?.fullName ||
          localSubscription
            .deliveryAddress
            ?.fullName ||
          "",

        email:
          user?.email ||
          "",

        contact:
          user?.phone ||
          localSubscription
            .deliveryAddress
            ?.phone ||
          "",
      },
    },
  };
}

function verifyCheckoutSignature({
  razorpayPaymentId,
  razorpaySubscriptionId,
  razorpaySignature,
}) {
  const {
    keySecret,
  } = getRazorpayCredentials();

  const message =
    `${razorpayPaymentId}|${razorpaySubscriptionId}`;

  const expectedSignature =
    crypto
      .createHmac(
        "sha256",
        keySecret
      )
      .update(message)
      .digest("hex");

  const expectedBuffer =
    Buffer.from(
      expectedSignature
    );

  const receivedBuffer =
    Buffer.from(
      cleanText(
        razorpaySignature
      )
    );

  return (
    expectedBuffer.length ===
      receivedBuffer.length &&
    crypto.timingSafeEqual(
      expectedBuffer,
      receivedBuffer
    )
  );
}

async function verifyRazorpayCheckout({
  localSubscriptionId,
  userId,
  razorpayPaymentId,
  razorpaySubscriptionId,
  razorpaySignature,
}) {
  const mandate =
    await RazorpaySubscriptionMandate.findOne(
      {
        localSubscription:
          localSubscriptionId,

        user:
          userId,

        razorpaySubscriptionId,
      }
    );

  if (!mandate) {
    throw createHttpError(
      "Razorpay mandate not found.",
      404
    );
  }

  const valid =
    verifyCheckoutSignature({
      razorpayPaymentId,
      razorpaySubscriptionId,
      razorpaySignature,
    });

  if (!valid) {
    throw createHttpError(
      "Razorpay payment signature verification failed.",
      400
    );
  }

  mandate.checkoutPaymentId =
    razorpayPaymentId;

  mandate.checkoutSignature =
    razorpaySignature;

  mandate.checkoutSignatureVerifiedAt =
    new Date();

  await mandate.save();

  const remoteSubscription =
    await fetchRazorpaySubscription(
      razorpaySubscriptionId
    );

  const syncedMandate =
    await syncMandateFromRazorpay(
      {
        subscriptionEntity:
          remoteSubscription,
      }
    );

  return syncedMandate;
}

async function refreshRazorpayMandate({
  localSubscriptionId,
  userId,
}) {
  const mandate =
    await RazorpaySubscriptionMandate.findOne(
      {
        localSubscription:
          localSubscriptionId,

        user:
          userId,
      }
    ).sort({
      createdAt: -1,
    });

  if (!mandate) {
    throw createHttpError(
      "No Razorpay mandate exists for this subscription.",
      404
    );
  }

  const remoteSubscription =
    await fetchRazorpaySubscription(
      mandate.razorpaySubscriptionId
    );

  return syncMandateFromRazorpay(
    {
      subscriptionEntity:
        remoteSubscription,
    }
  );
}

async function cancelRazorpayMandate({
  localSubscriptionId,
  userId,
  cancelAtCycleEnd = false,
}) {
  const mandate =
    await RazorpaySubscriptionMandate.findOne(
      {
        localSubscription:
          localSubscriptionId,

        user:
          userId,
      }
    ).sort({
      createdAt: -1,
    });

  if (!mandate) {
    throw createHttpError(
      "No Razorpay mandate exists for this subscription.",
      404
    );
  }

  if (
    TERMINAL_STATUSES.includes(
      mandate.status
    )
  ) {
    throw createHttpError(
      "This Razorpay subscription has already ended.",
      409
    );
  }

  const remoteSubscription =
    await razorpayRequest(
      `/subscriptions/${encodeURIComponent(
        mandate.razorpaySubscriptionId
      )}/cancel`,

      {
        method: "POST",

        body: {
          cancel_at_cycle_end:
            Boolean(
              cancelAtCycleEnd
            ),
        },
      }
    );

  mandate.cancelAtCycleEnd =
    Boolean(
      cancelAtCycleEnd
    );

  await mandate.save();

  return syncMandateFromRazorpay(
    {
      subscriptionEntity:
        remoteSubscription,
    }
  );
}

function verifyWebhookSignature({
  rawBody,
  signature,
}) {
  const webhookSecret =
  cleanText(
    process.env
      .RAZORPAY_SUBSCRIPTION_WEBHOOK_SECRET ||
      process.env
        .RAZORPAY_WEBHOOK_SECRET
  );

  if (!webhookSecret) {
    throw createHttpError(
      "Razorpay subscription webhook secret is not configured.",
      503
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

  const expectedBuffer =
    Buffer.from(
      expectedSignature
    );

  const receivedBuffer =
    Buffer.from(
      cleanText(signature)
    );

  return (
    expectedBuffer.length ===
      receivedBuffer.length &&
    crypto.timingSafeEqual(
      expectedBuffer,
      receivedBuffer
    )
  );
}

module.exports = {
  cancelRazorpayMandate,
  fetchRazorpaySubscription,
  prepareRazorpaySubscription,
  refreshRazorpayMandate,
  syncMandateFromRazorpay,
  verifyCheckoutSignature,
  verifyRazorpayCheckout,
  verifyWebhookSignature,
};