const crypto =
  require("crypto");

const mongoose =
  require("mongoose");

const DeliverySlot =
  require(
    "../models/DeliverySlot"
  );

const DeliverySlotReservation =
  require(
    "../models/DeliverySlotReservation"
  );

const DeliverySlotUsage =
  require(
    "../models/DeliverySlotUsage"
  );

const ServiceableLocation =
  require(
    "../models/ServiceableLocation"
  );

const IST_OFFSET_MS =
  5.5 *
  60 *
  60 *
  1000;

const ALL_WEEKDAYS = [
  0,
  1,
  2,
  3,
  4,
  5,
  6,
];

const DEFAULT_DELIVERY_SLOTS =
  [
    {
      slotCode:
        "morning-8-10",

      label:
        "8:00 AM – 10:00 AM",

      startMinutes:
        8 * 60,

      endMinutes:
        10 * 60,

      capacity: 25,
      cutoffMinutes: 180,
      sortOrder: 10,
    },

    {
      slotCode:
        "morning-10-12",

      label:
        "10:00 AM – 12:00 PM",

      startMinutes:
        10 * 60,

      endMinutes:
        12 * 60,

      capacity: 25,
      cutoffMinutes: 180,
      sortOrder: 20,
    },

    {
      slotCode:
        "afternoon-12-2",

      label:
        "12:00 PM – 2:00 PM",

      startMinutes:
        12 * 60,

      endMinutes:
        14 * 60,

      capacity: 25,
      cutoffMinutes: 180,
      sortOrder: 30,
    },

    {
      slotCode:
        "evening-4-6",

      label:
        "4:00 PM – 6:00 PM",

      startMinutes:
        16 * 60,

      endMinutes:
        18 * 60,

      capacity: 25,
      cutoffMinutes: 180,
      sortOrder: 40,
    },

    {
      slotCode:
        "evening-6-8",

      label:
        "6:00 PM – 8:00 PM",

      startMinutes:
        18 * 60,

      endMinutes:
        20 * 60,

      capacity: 25,
      cutoffMinutes: 180,
      sortOrder: 50,
    },
  ];

function createHttpError(
  message,
  statusCode = 400,
  code =
    "delivery_slot_error"
) {
  const error =
    new Error(message);

  error.statusCode =
    statusCode;

  error.code =
    code;

  return error;
}

function cleanText(value) {
  return String(
    value ?? ""
  ).trim();
}

function cleanPincode(value) {
  return String(
    value ?? ""
  )
    .replace(
      /\D/g,
      ""
    )
    .slice(
      0,
      6
    );
}

function normaliseSlotCode(
  value
) {
  return cleanText(value)
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      "-"
    )
    .replace(
      /^-+|-+$/g,
      ""
    );
}

function normaliseSlotLabel(
  value
) {
  return cleanText(value)
    .toLowerCase()
    .replace(
      /[–—−]/g,
      "-"
    )
    .replace(
      /\s+/g,
      " "
    )
    .replace(
      /\s*-\s*/g,
      "-"
    )
    .replace(
      /\b0(\d):/g,
      "$1:"
    );
}

function parseDateId(value) {
  const dateId =
    cleanText(value);

  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      dateId
    );

  if (!match) {
    throw createHttpError(
      "Select a valid delivery date.",
      400,
      "invalid_delivery_date"
    );
  }

  const year =
    Number(match[1]);

  const month =
    Number(match[2]);

  const day =
    Number(match[3]);

  const date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    );

  if (
    date.getUTCFullYear() !==
      year ||
    date.getUTCMonth() !==
      month - 1 ||
    date.getUTCDate() !==
      day
  ) {
    throw createHttpError(
      "Select a valid delivery date.",
      400,
      "invalid_delivery_date"
    );
  }

  return {
    dateId,
    year,
    month,
    day,

    weekday:
      date.getUTCDay(),
  };
}

function parseTimeToMinutes(
  value
) {
  const text =
    cleanText(value);

  const twentyFourHourMatch =
    /^(\d{1,2}):(\d{2})$/.exec(
      text
    );

  if (
    twentyFourHourMatch
  ) {
    const hour =
      Number(
        twentyFourHourMatch[1]
      );

    const minute =
      Number(
        twentyFourHourMatch[2]
      );

    if (
      hour >= 0 &&
      hour <= 23 &&
      minute >= 0 &&
      minute <= 59
    ) {
      return (
        hour * 60 +
        minute
      );
    }
  }

  const twelveHourMatch =
    /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(
      text
    );

  if (
    !twelveHourMatch
  ) {
    return null;
  }

  let hour =
    Number(
      twelveHourMatch[1]
    );

  const minute =
    Number(
      twelveHourMatch[2]
    );

  const meridiem =
    twelveHourMatch[3]
      .toUpperCase();

  if (
    hour < 1 ||
    hour > 12 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  if (hour === 12) {
    hour = 0;
  }

  if (
    meridiem ===
    "PM"
  ) {
    hour += 12;
  }

  return (
    hour * 60 +
    minute
  );
}

function parseSlotRange(
  value
) {
  const text =
    cleanText(value)
      .replace(
        /[–—−]/g,
        "-"
      );

  const match =
    /^(\d{1,2}:\d{2}\s*(?:AM|PM)?)\s*-\s*(\d{1,2}:\d{2}\s*(?:AM|PM)?)$/i.exec(
      text
    );

  if (!match) {
    return null;
  }

  const startMinutes =
    parseTimeToMinutes(
      match[1]
    );

  const endMinutes =
    parseTimeToMinutes(
      match[2]
    );

  if (
    startMinutes ===
      null ||
    endMinutes ===
      null ||
    endMinutes <=
      startMinutes
  ) {
    return null;
  }

  return {
    startMinutes,
    endMinutes,
  };
}

function formatMinutes(
  minutes
) {
  const safeMinutes =
    Number(minutes);

  const hour24 =
    Math.floor(
      safeMinutes /
        60
    );

  const minute =
    safeMinutes %
    60;

  const meridiem =
    hour24 >= 12
      ? "PM"
      : "AM";

  const hour12 =
    hour24 % 12 ||
    12;

  return `${hour12}:${String(
    minute
  ).padStart(
    2,
    "0"
  )} ${meridiem}`;
}

function createSlotLabel(
  startMinutes,
  endMinutes
) {
  return `${formatMinutes(
    startMinutes
  )} – ${formatMinutes(
    endMinutes
  )}`;
}

function createSlotCode(
  startMinutes,
  endMinutes
) {
  return `slot-${startMinutes}-${endMinutes}`;
}

function getSlotStartAt(
  deliveryDateId,
  startMinutes
) {
  const {
    year,
    month,
    day,
  } =
    parseDateId(
      deliveryDateId
    );

  const hour =
    Math.floor(
      Number(
        startMinutes
      ) / 60
    );

  const minute =
    Number(
      startMinutes
    ) % 60;

  return new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      hour,
      minute
    ) -
      IST_OFFSET_MS
  );
}

function getCutoffAt({
  deliveryDateId,
  startMinutes,
  cutoffMinutes,
}) {
  const slotStartAt =
    getSlotStartAt(
      deliveryDateId,
      startMinutes
    );

  return new Date(
    slotStartAt.getTime() -
      Number(
        cutoffMinutes ||
          0
      ) *
        60 *
        1000
  );
}

function queryWithSession(
  query,
  session
) {
  return session
    ? query.session(
        session
      )
    : query;
}

function getLocationId(
  value
) {
  if (!value) {
    return "";
  }

  if (value._id) {
    return String(
      value._id
    );
  }

  return String(value);
}

async function findServiceableLocation({
  pincode,
  session = null,
  requireActive = true,
}) {
  const cleanValue =
    cleanPincode(
      pincode
    );

  if (
    cleanValue.length !==
    6
  ) {
    throw createHttpError(
      "A valid six-digit pincode is required.",
      400,
      "invalid_pincode"
    );
  }

  const filter = {
    pincode:
      cleanValue,
  };

  if (requireActive) {
    filter.active =
      true;
  }

  const location =
    await queryWithSession(
      ServiceableLocation.findOne(
        filter
      ),
      session
    ).lean();

  if (!location) {
    throw createHttpError(
      "Delivery is not available for this pincode.",
      409,
      "location_unavailable"
    );
  }

  return location;
}

async function getEffectiveSlotConfigurations({
  location,
  session = null,
  includeInactive = false,
}) {
  const locationId =
    getLocationId(
      location
    );

  const filter = {
    $or: [
      {
        serviceableLocation:
          null,
      },
      {
        serviceableLocation:
          locationId,
      },
    ],
  };

  if (
    !includeInactive
  ) {
    filter.active =
      true;
  }

  const configurations =
    await queryWithSession(
      DeliverySlot.find(
        filter
      ).sort({
        sortOrder: 1,
        startMinutes: 1,
        createdAt: 1,
      }),
      session
    ).lean();

  const effectiveByCode =
    new Map();

  for (
    const configuration of
    configurations
  ) {
    const code =
      normaliseSlotCode(
        configuration.slotCode
      );

    const isLocationSpecific =
      getLocationId(
        configuration
          .serviceableLocation
      ) ===
      locationId;

    const current =
      effectiveByCode.get(
        code
      );

    if (
      !current ||
      isLocationSpecific
    ) {
      effectiveByCode.set(
        code,
        configuration
      );
    }
  }

  return [
    ...effectiveByCode.values(),
  ].sort(
    (
      left,
      right
    ) =>
      Number(
        left.sortOrder ||
          0
      ) -
        Number(
          right.sortOrder ||
            0
        ) ||
      Number(
        left.startMinutes
      ) -
        Number(
          right.startMinutes
        )
  );
}

function findMatchingSlot(
  configurations,
  schedule
) {
  const requestedCode =
    normaliseSlotCode(
      schedule
        ?.deliverySlotCode ||
        schedule
          ?.slotCode
    );

  if (requestedCode) {
    const byCode =
      configurations.find(
        (
          configuration
        ) =>
          normaliseSlotCode(
            configuration
              .slotCode
          ) ===
          requestedCode
      );

    if (byCode) {
      return byCode;
    }
  }

  const requestedLabel =
    cleanText(
      schedule
        ?.deliverySlot ||
        schedule
          ?.slotLabel ||
        schedule?.label
    );

  const normalisedLabel =
    normaliseSlotLabel(
      requestedLabel
    );

  if (
    normalisedLabel
  ) {
    const byLabel =
      configurations.find(
        (
          configuration
        ) =>
          normaliseSlotLabel(
            configuration
              .label
          ) ===
          normalisedLabel
      );

    if (byLabel) {
      return byLabel;
    }
  }

  const requestedRange =
    parseSlotRange(
      requestedLabel
    );

  if (
    requestedRange
  ) {
    return configurations.find(
      (
        configuration
      ) =>
        Number(
          configuration
            .startMinutes
        ) ===
          requestedRange
            .startMinutes &&
        Number(
          configuration
            .endMinutes
        ) ===
          requestedRange
            .endMinutes
    );
  }

  return null;
}

function assertSlotCanBeBooked({
  configuration,
  deliveryDateId,
  now = new Date(),
}) {
  const dateParts =
    parseDateId(
      deliveryDateId
    );

  const weekdays =
    Array.isArray(
      configuration.weekdays
    )
      ? configuration.weekdays.map(
          Number
        )
      : ALL_WEEKDAYS;

  if (
    !weekdays.includes(
      dateParts.weekday
    )
  ) {
    throw createHttpError(
      "This delivery slot is not scheduled for the selected day.",
      409,
      "slot_not_scheduled"
    );
  }

  const cutoffAt =
    getCutoffAt({
      deliveryDateId:
        dateParts.dateId,

      startMinutes:
        configuration
          .startMinutes,

      cutoffMinutes:
        configuration
          .cutoffMinutes,
    });

  if (
    new Date(
      now
    ).getTime() >=
    cutoffAt.getTime()
  ) {
    throw createHttpError(
      "The booking cutoff for this delivery slot has passed. Please select another slot.",
      409,
      "slot_cutoff_passed"
    );
  }

  return {
    dateParts,
    cutoffAt,
  };
}

async function resolveDeliverySlot({
  pincode,
  deliveryDateId,
  schedule,
  session = null,
  now = new Date(),
}) {
  const location =
    await findServiceableLocation({
      pincode,
      session,
      requireActive:
        true,
    });

  const configurations =
    await getEffectiveSlotConfigurations({
      location,
      session,
      includeInactive:
        false,
    });

  const configuration =
    findMatchingSlot(
      configurations,
      schedule
    );

  if (!configuration) {
    throw createHttpError(
      "The selected delivery slot is no longer available. Please select another slot.",
      409,
      "slot_unavailable"
    );
  }

  const {
    cutoffAt,
  } =
    assertSlotCanBeBooked({
      configuration,
      deliveryDateId,
      now,
    });

  return {
    location,
    configuration,
    cutoffAt,
  };
}

function buildUsageFilter({
  location,
  deliveryDateId,
  slotCode,
}) {
  return {
    serviceableLocation:
      location._id,

    deliveryDateId:
      cleanText(
        deliveryDateId
      ),

    slotCode:
      normaliseSlotCode(
        slotCode
      ),
  };
}

async function ensureUsageDocument({
  location,
  configuration,
  deliveryDateId,
  session = null,
}) {
  const filter =
    buildUsageFilter({
      location,
      deliveryDateId,

      slotCode:
        configuration
          .slotCode,
    });

  try {
    return await DeliverySlotUsage.findOneAndUpdate(
      filter,

      {
        $set: {
          slot:
            configuration
              ._id,

          slotLabel:
            configuration
              .label,

          capacitySnapshot:
            Number(
              configuration
                .capacity
            ),
        },

        $setOnInsert: {
          pincode:
            location.pincode,

          reservedCount:
            0,
        },
      },

      {
        new: true,
        upsert: true,

        setDefaultsOnInsert:
          true,

        session,
      }
    );
  } catch (error) {
    if (
      error.code !==
      11000
    ) {
      throw error;
    }

    return queryWithSession(
      DeliverySlotUsage.findOne(
        filter
      ),
      session
    );
  }
}

async function incrementUsage({
  location,
  configuration,
  deliveryDateId,
  session = null,
}) {
  await ensureUsageDocument({
    location,
    configuration,
    deliveryDateId,
    session,
  });

  const filter =
    buildUsageFilter({
      location,
      deliveryDateId,

      slotCode:
        configuration
          .slotCode,
    });

  const capacity =
    Number(
      configuration.capacity
    );

  const usage =
    await DeliverySlotUsage.findOneAndUpdate(
      {
        ...filter,

        reservedCount: {
          $lt: capacity,
        },
      },

      {
        $inc: {
          reservedCount:
            1,
        },

        $set: {
          slot:
            configuration
              ._id,

          slotLabel:
            configuration
              .label,

          capacitySnapshot:
            capacity,

          lastReservationAt:
            new Date(),
        },
      },

      {
        new: true,
        session,
      }
    );

  if (!usage) {
    throw createHttpError(
      "This delivery slot is full. Please select another slot.",
      409,
      "slot_full"
    );
  }

  return usage;
}

async function decrementUsage({
  reservation,
  session = null,
}) {
  return DeliverySlotUsage.findOneAndUpdate(
    {
      serviceableLocation:
        reservation
          .serviceableLocation,

      deliveryDateId:
        reservation
          .deliveryDateId,

      slotCode:
        reservation.slotCode,

      reservedCount: {
        $gt: 0,
      },
    },

    {
      $inc: {
        reservedCount:
          -1,
      },

      $set: {
        lastReleaseAt:
          new Date(),
      },
    },

    {
      new: true,
      session,
    }
  );
}

function createReservationToken() {
  return crypto
    .randomBytes(24)
    .toString("hex");
}

function reservationSnapshot(
  reservation
) {
  return {
    reservationToken:
      reservation
        .reservationToken,

    slotId:
      String(
        reservation.slot
      ),

    slotCode:
      reservation.slotCode,

    slotLabel:
      reservation.slotLabel,

    startMinutes:
      reservation
        .startMinutes,

    endMinutes:
      reservation
        .endMinutes,

    cutoffMinutes:
      reservation
        .cutoffMinutes,

    capacitySnapshot:
      reservation
        .capacitySnapshot,
  };
}

async function createReservation({
  userId = null,
  pincode,
  deliveryDateId,
  schedule,
  source = "system",
  session = null,
  now = new Date(),
}) {
  const {
    location,
    configuration,
  } =
    await resolveDeliverySlot({
      pincode,
      deliveryDateId,
      schedule,
      session,
      now,
    });

  await incrementUsage({
    location,
    configuration,
    deliveryDateId,
    session,
  });

  const reservationToken =
    createReservationToken();

  try {
    const document = {
      reservationToken,

      user:
        userId ||
        null,

      source,

      serviceableLocation:
        location._id,

      pincode:
        location.pincode,

      deliveryDateId:
        cleanText(
          deliveryDateId
        ),

      slot:
        configuration._id,

      slotCode:
        configuration
          .slotCode,

      slotLabel:
        configuration.label,

      startMinutes:
        configuration
          .startMinutes,

      endMinutes:
        configuration
          .endMinutes,

      cutoffMinutes:
        configuration
          .cutoffMinutes,

      capacitySnapshot:
        configuration
          .capacity,

      status:
        "reserved",

      reservedAt:
        new Date(),
    };

    let reservation;

    if (session) {
      const reservations =
        await DeliverySlotReservation.create(
          [document],
          {
            session,
          }
        );

      reservation =
        reservations[0];
    } else {
      reservation =
        await DeliverySlotReservation.create(
          document
        );
    }

    return reservation;
  } catch (error) {
    await DeliverySlotUsage.findOneAndUpdate(
      {
        serviceableLocation:
          location._id,

        deliveryDateId:
          cleanText(
            deliveryDateId
          ),

        slotCode:
          configuration
            .slotCode,

        reservedCount: {
          $gt: 0,
        },
      },

      {
        $inc: {
          reservedCount:
            -1,
        },
      },

      {
        session,
      }
    );

    throw error;
  }
}

async function reserveDeliverySlotForSchedule({
  userId = null,
  pincode,
  schedule,
  source = "system",
  session = null,
  now = new Date(),
}) {
  if (!schedule) {
    throw createHttpError(
      "Delivery date and slot are required.",
      400,
      "delivery_schedule_missing"
    );
  }

  const deliveryDateId =
    cleanText(
      schedule
        .deliveryDateId
    );

  const reservation =
    await createReservation({
      userId,
      pincode,
      deliveryDateId,
      schedule,
      source,
      session,
      now,
    });

  return reservationSnapshot(
    reservation
  );
}

async function reactivateReservation({
  reservation,
  session = null,
  now = new Date(),
}) {
  const {
    location,
    configuration,
  } =
    await resolveDeliverySlot({
      pincode:
        reservation.pincode,

      deliveryDateId:
        reservation
          .deliveryDateId,

      schedule: {
        deliverySlotCode:
          reservation
            .slotCode,

        deliverySlot:
          reservation
            .slotLabel,
      },

      session,
      now,
    });

  await incrementUsage({
    location,
    configuration,

    deliveryDateId:
      reservation
        .deliveryDateId,

    session,
  });

  reservation.serviceableLocation =
    location._id;

  reservation.slot =
    configuration._id;

  reservation.slotCode =
    configuration.slotCode;

  reservation.slotLabel =
    configuration.label;

  reservation.startMinutes =
    configuration.startMinutes;

  reservation.endMinutes =
    configuration.endMinutes;

  reservation.cutoffMinutes =
    configuration.cutoffMinutes;

  reservation.capacitySnapshot =
    configuration.capacity;

  reservation.status =
    "reserved";

  reservation.reservedAt =
    new Date();

  reservation.releasedAt =
    null;

  reservation.releaseReason =
    "";

  await reservation.save({
    session,
  });

  return reservation;
}

async function consumeDeliverySlotReservation({
  reservationToken,
  orderId,
  userId = null,
  pincode,
  schedule,
  source = "order",
  session = null,
  now = new Date(),
}) {
  let reservation =
    null;

  const cleanToken =
    cleanText(
      reservationToken
    );

  if (cleanToken) {
    reservation =
      await queryWithSession(
        DeliverySlotReservation.findOne(
          {
            reservationToken:
              cleanToken,
          }
        ),
        session
      );
  }

  if (!reservation) {
    const snapshot =
      await reserveDeliverySlotForSchedule({
        userId,
        pincode,
        schedule,
        source,
        session,
        now,
      });

    reservation =
      await queryWithSession(
        DeliverySlotReservation.findOne(
          {
            reservationToken:
              snapshot
                .reservationToken,
          }
        ),
        session
      );
  }

  if (!reservation) {
    throw createHttpError(
      "Unable to reserve the selected delivery slot.",
      409,
      "slot_reservation_missing"
    );
  }

  if (
    reservation.status ===
      "released" ||
    reservation.status ===
      "releasing"
  ) {
    reservation =
      await reactivateReservation({
        reservation,
        session,
        now,
      });
  }

  if (
    reservation.order &&
    String(
      reservation.order
    ) !==
      String(orderId)
  ) {
    throw createHttpError(
      "This delivery-slot reservation is already linked to another order.",
      409,
      "slot_reservation_conflict"
    );
  }

  reservation.order =
    orderId;

  reservation.user =
    userId ||
    reservation.user ||
    null;

  reservation.source =
    source;

  reservation.status =
    "consumed";

  reservation.consumedAt =
    reservation.consumedAt ||
    new Date();

  await reservation.save({
    session,
  });

  return reservationSnapshot(
    reservation
  );
}

async function releaseDeliverySlotReservation({
  reservationToken,
  reason =
    "Reservation released.",
  session = null,
}) {
  const cleanToken =
    cleanText(
      reservationToken
    );

  if (!cleanToken) {
    return {
      released: false,

      reason:
        "No delivery-slot reservation token was stored.",
    };
  }

  const reservation =
    await DeliverySlotReservation.findOneAndUpdate(
      {
        reservationToken:
          cleanToken,

        status: {
          $in: [
            "reserved",
            "consumed",
          ],
        },
      },

      {
        $set: {
          status:
            "releasing",

          releaseReason:
            cleanText(
              reason
            ).slice(
              0,
              300
            ),
        },
      },

      {
        new: false,
        session,
      }
    );

  if (!reservation) {
    const existing =
      await queryWithSession(
        DeliverySlotReservation.findOne(
          {
            reservationToken:
              cleanToken,
          }
        ).lean(),
        session
      );

    return {
      released:
        existing?.status ===
        "released",

      alreadyReleased:
        existing?.status ===
        "released",
    };
  }

  try {
    await decrementUsage({
      reservation,
      session,
    });

    await DeliverySlotReservation.updateOne(
      {
        _id:
          reservation._id,
      },

      {
        $set: {
          status:
            "released",

          releasedAt:
            new Date(),

          releaseReason:
            cleanText(
              reason
            ).slice(
              0,
              300
            ),
        },
      },

      {
        session,
      }
    );

    return {
      released: true,

      alreadyReleased:
        false,
    };
  } catch (error) {
    await DeliverySlotReservation.updateOne(
      {
        _id:
          reservation._id,
      },

      {
        $set: {
          status:
            reservation
              .status,
        },
      },

      {
        session,
      }
    );

    throw error;
  }
}

function applyReservationToSchedule(
  schedule,
  snapshot
) {
  schedule.deliverySlot =
    snapshot.slotLabel;

  schedule.deliverySlotCode =
    snapshot.slotCode;

  schedule.deliverySlotId =
    snapshot.slotId;

  schedule.deliverySlotStartMinutes =
    snapshot.startMinutes;

  schedule.deliverySlotEndMinutes =
    snapshot.endMinutes;

  schedule.deliverySlotCutoffMinutes =
    snapshot.cutoffMinutes;

  schedule.deliverySlotCapacitySnapshot =
    snapshot.capacitySnapshot;

  schedule.deliverySlotReservationToken =
    snapshot.reservationToken;

  return schedule;
}

async function ensureOrderDeliverySlotReservation({
  order,
  session = null,
  now = new Date(),
}) {
  if (
    !order
      ?.deliverySchedule ||
    !order
      ?.deliveryAddress
  ) {
    throw createHttpError(
      "Order delivery details are incomplete.",
      400,
      "delivery_details_missing"
    );
  }

  const snapshot =
    await consumeDeliverySlotReservation({
      reservationToken:
        order
          .deliverySchedule
          .deliverySlotReservationToken,

      orderId:
        order._id,

      userId:
        order.user,

      pincode:
        order
          .deliveryAddress
          .pincode,

      schedule:
        order
          .deliverySchedule,

      source:
        order.orderSource ===
        "subscription"
          ? "subscription"
          : "order",

      session,
      now,
    });

  applyReservationToSchedule(
    order.deliverySchedule,
    snapshot
  );

  return snapshot;
}

async function getDeliverySlotCatalog({
  pincode = "",
}) {
  let configurations;
  let location = null;

  const cleanValue =
    cleanPincode(
      pincode
    );

  if (cleanValue) {
    location =
      await findServiceableLocation({
        pincode:
          cleanValue,
      });

    configurations =
      await getEffectiveSlotConfigurations({
        location,
      });
  } else {
    configurations =
      await DeliverySlot.find({
        active: true,

        serviceableLocation:
          null,
      })
        .sort({
          sortOrder: 1,
          startMinutes: 1,
        })
        .lean();
  }

  return {
    location,

    slots:
      configurations.map(
        (
          configuration
        ) => ({
          id:
            String(
              configuration
                ._id
            ),

          slotCode:
            configuration
              .slotCode,

          label:
            configuration
              .label,

          startMinutes:
            configuration
              .startMinutes,

          endMinutes:
            configuration
              .endMinutes,

          capacity:
            configuration
              .capacity,

          cutoffMinutes:
            configuration
              .cutoffMinutes,

          weekdays:
            configuration
              .weekdays,

          active:
            configuration
              .active,

          sortOrder:
            configuration
              .sortOrder,

          locationSpecific:
            Boolean(
              configuration
                .serviceableLocation
            ),
        })
      ),
  };
}

async function getDeliverySlotAvailability({
  pincode,
  deliveryDateId,
  now = new Date(),
}) {
  const location =
    await findServiceableLocation({
      pincode,
    });

  const dateParts =
    parseDateId(
      deliveryDateId
    );

  const configurations =
    await getEffectiveSlotConfigurations({
      location,
    });

  const slotCodes =
    configurations.map(
      (
        configuration
      ) =>
        configuration
          .slotCode
    );

  const usages =
    await DeliverySlotUsage.find({
      serviceableLocation:
        location._id,

      deliveryDateId:
        dateParts.dateId,

      slotCode: {
        $in:
          slotCodes,
      },
    }).lean();

  const usageByCode =
    new Map(
      usages.map(
        (usage) => [
          normaliseSlotCode(
            usage.slotCode
          ),
          usage,
        ]
      )
    );

  const slots =
    configurations.map(
      (
        configuration
      ) => {
        const usage =
          usageByCode.get(
            normaliseSlotCode(
              configuration
                .slotCode
            )
          );

        const capacity =
          Number(
            configuration
              .capacity
          );

        const booked =
          Number(
            usage
              ?.reservedCount ||
              0
          );

        const remaining =
          Math.max(
            0,
            capacity -
              booked
          );

        const scheduled =
          (
            configuration
              .weekdays ||
            ALL_WEEKDAYS
          ).includes(
            dateParts.weekday
          );

        const cutoffAt =
          getCutoffAt({
            deliveryDateId:
              dateParts.dateId,

            startMinutes:
              configuration
                .startMinutes,

            cutoffMinutes:
              configuration
                .cutoffMinutes,
          });

        const cutoffPassed =
          new Date(
            now
          ).getTime() >=
          cutoffAt.getTime();

        let reason =
          "";

        if (!scheduled) {
          reason =
            "not_scheduled";
        } else if (
          cutoffPassed
        ) {
          reason =
            "cutoff_passed";
        } else if (
          remaining <=
          0
        ) {
          reason =
            "full";
        }

        return {
          id:
            String(
              configuration
                ._id
            ),

          slotCode:
            configuration
              .slotCode,

          label:
            configuration
              .label,

          startMinutes:
            configuration
              .startMinutes,

          endMinutes:
            configuration
              .endMinutes,

          capacity,
          booked,
          remaining,

          cutoffMinutes:
            configuration
              .cutoffMinutes,

          cutoffAt:
            cutoffAt
              .toISOString(),

          weekdays:
            configuration
              .weekdays,

          available:
            !reason,

          reason,

          locationSpecific:
            Boolean(
              configuration
                .serviceableLocation
            ),
        };
      }
    );

  return {
    location,

    deliveryDateId:
      dateParts.dateId,

    slots,
  };
}

function parseWeekdays(
  value
) {
  if (
    !Array.isArray(
      value
    )
  ) {
    return ALL_WEEKDAYS;
  }

  const weekdays = [
    ...new Set(
      value
        .map(Number)
        .filter(
          (day) =>
            Number.isInteger(
              day
            ) &&
            day >= 0 &&
            day <= 6
        )
    ),
  ].sort(
    (
      left,
      right
    ) =>
      left -
      right
  );

  if (
    weekdays.length ===
    0
  ) {
    throw createHttpError(
      "Select at least one delivery weekday."
    );
  }

  return weekdays;
}

function parseSlotConfigurationInput(
  input,
  existing = null
) {
  const startMinutes =
    input.startMinutes !==
    undefined
      ? Number(
          input.startMinutes
        )
      : input.startTime !==
          undefined
        ? parseTimeToMinutes(
            input.startTime
          )
        : existing
            ?.startMinutes;

  const endMinutes =
    input.endMinutes !==
    undefined
      ? Number(
          input.endMinutes
        )
      : input.endTime !==
          undefined
        ? parseTimeToMinutes(
            input.endTime
          )
        : existing
            ?.endMinutes;

  if (
    !Number.isInteger(
      startMinutes
    ) ||
    startMinutes < 0 ||
    startMinutes > 1439
  ) {
    throw createHttpError(
      "Enter a valid delivery-slot start time."
    );
  }

  if (
    !Number.isInteger(
      endMinutes
    ) ||
    endMinutes <=
      startMinutes ||
    endMinutes > 1440
  ) {
    throw createHttpError(
      "The delivery-slot end time must be later than its start time."
    );
  }

  const capacity =
    input.capacity !==
    undefined
      ? Number(
          input.capacity
        )
      : Number(
          existing
            ?.capacity ||
            25
        );

  if (
    !Number.isInteger(
      capacity
    ) ||
    capacity < 1 ||
    capacity > 10000
  ) {
    throw createHttpError(
      "Delivery-slot capacity must be between 1 and 10,000."
    );
  }

  const cutoffMinutes =
    input.cutoffMinutes !==
    undefined
      ? Number(
          input
            .cutoffMinutes
        )
      : Number(
          existing
            ?.cutoffMinutes ??
            180
        );

  if (
    !Number.isInteger(
      cutoffMinutes
    ) ||
    cutoffMinutes < 0 ||
    cutoffMinutes > 10080
  ) {
    throw createHttpError(
      "Delivery-slot cutoff must be between 0 and 10,080 minutes."
    );
  }

  const label =
    cleanText(
      input.label
    ) ||
    cleanText(
      existing?.label
    ) ||
    createSlotLabel(
      startMinutes,
      endMinutes
    );

  const slotCode =
    normaliseSlotCode(
      input.slotCode ||
        existing
          ?.slotCode ||
        createSlotCode(
          startMinutes,
          endMinutes
        )
    );

  if (!slotCode) {
    throw createHttpError(
      "A delivery-slot code is required."
    );
  }

  return {
    slotCode,
    label,
    startMinutes,
    endMinutes,
    capacity,
    cutoffMinutes,

    weekdays:
      input.weekdays !==
      undefined
        ? parseWeekdays(
            input.weekdays
          )
        : existing
            ?.weekdays ||
          ALL_WEEKDAYS,

    active:
      input.active !==
      undefined
        ? Boolean(
            input.active
          )
        : existing
            ?.active ??
          true,

    sortOrder:
      input.sortOrder !==
      undefined
        ? Number(
            input
              .sortOrder
          ) || 0
        : Number(
            existing
              ?.sortOrder ||
              0
          ),
  };
}

async function resolveConfigurationLocation(
  pincode
) {
  const cleanValue =
    cleanPincode(
      pincode
    );

  if (!cleanValue) {
    return null;
  }

  return findServiceableLocation({
    pincode:
      cleanValue,

    requireActive:
      false,
  });
}

async function createDeliverySlotConfiguration(
  input
) {
  const values =
    parseSlotConfigurationInput(
      input
    );

  const location =
    await resolveConfigurationLocation(
      input.pincode
    );

  return DeliverySlot.create({
    ...values,

    serviceableLocation:
      location?._id ||
      null,

    pincodeSnapshot:
      location
        ?.pincode ||
      "",
  });
}

async function updateDeliverySlotConfiguration({
  slotId,
  input,
}) {
  if (
    !mongoose.isValidObjectId(
      slotId
    )
  ) {
    throw createHttpError(
      "Delivery slot not found.",
      404
    );
  }

  const slot =
    await DeliverySlot.findById(
      slotId
    );

  if (!slot) {
    throw createHttpError(
      "Delivery slot not found.",
      404
    );
  }

  const values =
    parseSlotConfigurationInput(
      input,
      slot
    );

  let location =
    null;

  if (
    input.pincode !==
    undefined
  ) {
    location =
      await resolveConfigurationLocation(
        input.pincode
      );
  } else if (
    slot.serviceableLocation
  ) {
    location =
      await ServiceableLocation.findById(
        slot
          .serviceableLocation
      ).lean();
  }

  Object.assign(
    slot,
    values,
    {
      serviceableLocation:
        location?._id ||
        null,

      pincodeSnapshot:
        location
          ?.pincode ||
        "",
    }
  );

  await slot.save();

  return slot;
}

async function listDeliverySlotConfigurations({
  includeInactive = true,
} = {}) {
  const filter = {};

  if (
    !includeInactive
  ) {
    filter.active =
      true;
  }

  return DeliverySlot.find(
    filter
  )
    .populate(
      "serviceableLocation",

      "pincode area city active"
    )
    .sort({
      pincodeSnapshot: 1,
      sortOrder: 1,
      startMinutes: 1,
    })
    .lean();
}

async function ensureDefaultDeliverySlots() {
  for (
    const slot of
    DEFAULT_DELIVERY_SLOTS
  ) {
    await DeliverySlot.updateOne(
      {
        serviceableLocation:
          null,

        slotCode:
          slot.slotCode,
      },

      {
        $setOnInsert: {
          ...slot,

          weekdays:
            ALL_WEEKDAYS,

          pincodeSnapshot:
            "",

          active: true,
        },
      },

      {
        upsert: true,
      }
    );
  }
}

module.exports = {
  ALL_WEEKDAYS,
  DEFAULT_DELIVERY_SLOTS,
  applyReservationToSchedule,
  createDeliverySlotConfiguration,
  createHttpError,
  createSlotLabel,
  ensureDefaultDeliverySlots,
  ensureOrderDeliverySlotReservation,
  formatMinutes,
  getDeliverySlotAvailability,
  getDeliverySlotCatalog,
  listDeliverySlotConfigurations,
  normaliseSlotCode,
  parseSlotConfigurationInput,
  parseTimeToMinutes,
  releaseDeliverySlotReservation,
  reserveDeliverySlotForSchedule,
  updateDeliverySlotConfiguration,
};