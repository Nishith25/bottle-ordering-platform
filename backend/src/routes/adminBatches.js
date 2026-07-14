const express = require("express");

const {
  protect,
  allowRoles,
} = require("../middleware/auth");

const BatchRecord = require("../models/BatchRecord");
const Product = require("../models/Product");

const router = express.Router();

router.use(protect);
router.use(allowRoles("admin"));

const IST_OFFSET_MS =
  5.5 * 60 * 60 * 1000;

function cleanText(value) {
  return String(value ?? "").trim();
}

function cleanSlug(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function createHttpError(
  message,
  statusCode = 400
) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function getTodayDateIdInIst() {
  return new Date(
    Date.now() + IST_OFFSET_MS
  )
    .toISOString()
    .slice(0, 10);
}

function parseDateId(value) {
  const dateId =
    cleanText(value) ||
    getTodayDateIdInIst();

  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      dateId
    );

  if (!match) {
    throw createHttpError(
      "Please select a valid production date."
    );
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const parsedDate =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    );

  if (
    parsedDate.getUTCFullYear() !==
      year ||
    parsedDate.getUTCMonth() !==
      month - 1 ||
    parsedDate.getUTCDate() !==
      day
  ) {
    throw createHttpError(
      "Please select a valid production date."
    );
  }

  return dateId;
}

function parsePackedOnAt(value) {
  if (!cleanText(value)) {
    return new Date();
  }

  const packedOnAt =
    new Date(value);

  if (
    Number.isNaN(
      packedOnAt.getTime()
    )
  ) {
    throw createHttpError(
      "Please enter a valid packed-on date and time."
    );
  }

  return packedOnAt;
}

function parsePositiveInteger(
  value,
  fieldName,
  {
    min = 1,
    max = 10000,
  } = {}
) {
  const numberValue = Number(value);

  if (
    !Number.isInteger(numberValue) ||
    numberValue < min ||
    numberValue > max
  ) {
    throw createHttpError(
      `${fieldName} must be a whole number between ${min} and ${max}.`
    );
  }

  return numberValue;
}

function createProductBatchCode(product) {
  const productId =
    cleanSlug(product.productId);

  const firstToken =
    productId.split("-")[0] || productId;

  const code =
    firstToken
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 3)
      .toUpperCase();

  return code || "BAT";
}

function compactDateId(dateId) {
  return dateId.replace(/-/g, "");
}

function getCreatedBySnapshot(user) {
  if (!user) {
    return null;
  }

  return {
    fullName:
      cleanText(user.fullName),

    email:
      cleanText(user.email).toLowerCase(),

    role:
      cleanText(user.role),
  };
}

function calculateUseByAt({
  packedOnAt,
  shelfLifeDays,
}) {
  return new Date(
    packedOnAt.getTime() +
      shelfLifeDays *
        24 *
        60 *
        60 *
        1000
  );
}

async function generateBatchNumber({
  product,
  productionDateId,
}) {
  const prefix = `SS-${createProductBatchCode(
    product
  )}-${compactDateId(productionDateId)}`;

  const latestBatch =
    await BatchRecord.findOne({
      batchNumber: {
        $regex: `^${prefix}-\\d{2,}$`,
      },
    })
      .sort({
        batchNumber: -1,
      })
      .lean();

  let nextSequence = 1;

  if (latestBatch?.batchNumber) {
    const parts =
      latestBatch.batchNumber.split("-");

    const lastPart =
      Number(parts[parts.length - 1]);

    if (
      Number.isInteger(lastPart) &&
      lastPart >= 1
    ) {
      nextSequence = lastPart + 1;
    }
  }

  for (
    let sequence = nextSequence;
    sequence < nextSequence + 50;
    sequence += 1
  ) {
    const batchNumber =
      `${prefix}-${String(sequence).padStart(2, "0")}`;

    const exists =
      await BatchRecord.exists({
        batchNumber,
      });

    if (!exists) {
      return batchNumber;
    }
  }

  throw createHttpError(
    "Unable to generate a unique batch number. Please try again.",
    409
  );
}

router.get(
  "/next-number",
  async (req, res, next) => {
    try {
      const productId =
        cleanSlug(req.query.productId);

      if (!productId) {
        throw createHttpError(
          "Please select a product."
        );
      }

      const productionDateId =
        parseDateId(
          req.query.productionDateId ||
            req.query.date
        );

      const product =
        await Product.findOne({
          productId,
        }).lean();

      if (!product) {
        throw createHttpError(
          "Product not found.",
          404
        );
      }

      const batchNumber =
        await generateBatchNumber({
          product,
          productionDateId,
        });

      return res.status(200).json({
        success: true,

        data: {
          batchNumber,
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);

router.get(
  "/",
  async (req, res, next) => {
    try {
      const date =
        cleanText(req.query.date);

      const productId =
        cleanSlug(req.query.productId);

      const limitValue =
        Number(req.query.limit);

      const limit =
        Number.isInteger(limitValue)
          ? Math.min(
              Math.max(limitValue, 1),
              250
            )
          : 120;

      const filter = {};

      if (date) {
        filter.productionDateId =
          parseDateId(date);
      }

      if (
        productId &&
        productId !== "all"
      ) {
        filter.productId =
          productId;
      }

      const batches =
        await BatchRecord.find(filter)
          .populate(
            "createdBy",
            "fullName email role"
          )
          .sort({
            packedOnAt: -1,
            createdAt: -1,
          })
          .limit(limit)
          .lean();

      return res.status(200).json({
        success: true,
        count: batches.length,

        data: {
          batches,
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);

router.post(
  "/",
  async (req, res, next) => {
    try {
      const productId =
        cleanSlug(req.body.productId);

      if (!productId) {
        throw createHttpError(
          "Please select a product."
        );
      }

      const product =
        await Product.findOne({
          productId,
        }).lean();

      if (!product) {
        throw createHttpError(
          "Product not found.",
          404
        );
      }

      const productionDateId =
        parseDateId(
          req.body.productionDateId
        );

      const packedOnAt =
        parsePackedOnAt(
          req.body.packedOnAt
        );

      const shelfLifeDays =
        parsePositiveInteger(
          req.body.shelfLifeDays ?? 3,
          "Shelf life",
          {
            min: 1,
            max: 30,
          }
        );

      const quantityPacked =
        parsePositiveInteger(
          req.body.quantityPacked,
          "Quantity packed",
          {
            min: 1,
            max: 10000,
          }
        );

      const batchNumber =
        cleanText(req.body.batchNumber)
          .toUpperCase() ||
        (await generateBatchNumber({
          product,
          productionDateId,
        }));

      const useByAt =
        calculateUseByAt({
          packedOnAt,
          shelfLifeDays,
        });

      const batch =
        await BatchRecord.create({
          batchNumber,

          product:
            product._id,

          productId:
            product.productId,

          productName:
            product.name,

          productShortName:
            product.shortName,

          sizeMl:
            product.sizeMl,

          productionDateId,
          packedOnAt,
          useByAt,
          shelfLifeDays,
          quantityPacked,

          status: "packed",

          notes:
            cleanText(req.body.notes).slice(
              0,
              500
            ),

          createdBy:
            req.user?._id || null,

          createdBySnapshot:
            getCreatedBySnapshot(req.user),
        });

      return res.status(201).json({
        success: true,

        message:
          "Batch record created successfully.",

        data: {
          batch,
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);

module.exports = router;