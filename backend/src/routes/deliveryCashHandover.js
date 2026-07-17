const express = require("express");

const {
  protect,
  allowRoles,
} = require("../middleware/auth");

const CashCollection = require("../models/CashCollection");

const router = express.Router();

router.use(protect);
router.use(allowRoles("delivery"));

function cleanText(value) {
  return String(value || "").trim();
}

function parseAmount(value, fallback = 0) {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : fallback;
}

function getDateIdInIndia() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function getDayRangeInIndia(dateId) {
  return {
    start: new Date(`${dateId}T00:00:00.000+05:30`),
    end: new Date(`${dateId}T23:59:59.999+05:30`),
  };
}

function buildPartnerSnapshot(user) {
  return {
    fullName: cleanText(user?.fullName),
    email: cleanText(user?.email),
    phone: cleanText(user?.phone),
    role: cleanText(user?.role) || "delivery",
  };
}

function getRowAmount(row) {
  return Number(
    row.amountCollected ||
      row.amountDue ||
      0
  );
}

function buildBatchGroups(rows) {
  const map = new Map();

  for (const row of rows) {
    const batchId =
      cleanText(row.deliveryHandoverBatchId) ||
      `single-${row._id}`;

    if (!map.has(batchId)) {
      map.set(batchId, {
        batchId,
        status: row.status,
        dateId:
          row.handoverDateId ||
          row.collectionDateId ||
          "",
        submittedAt:
          row.handoverSubmittedAt || null,
        verifiedAt:
          row.handoverVerifiedAt ||
          row.handedOverAt ||
          null,
        expectedAmount: 0,
        submittedAmount: Number(
          row.handoverSubmittedAmount || 0
        ),
        receivedAmount: Number(
          row.handoverReceivedAmount || 0
        ),
        shortAmount: Number(
          row.handoverShortAmount || 0
        ),
        partnerNote:
          row.handoverPartnerNote || "",
        adminNote:
          row.handoverAdminNote || "",
        orderCount: 0,
        orders: [],
      });
    }

    const batch = map.get(batchId);
    const amount = getRowAmount(row);

    batch.expectedAmount += amount;
    batch.orderCount += 1;

    if (!batch.submittedAmount) {
      batch.submittedAmount =
        Number(row.handoverSubmittedAmount || 0);
    }

    if (!batch.receivedAmount) {
      batch.receivedAmount =
        Number(row.handoverReceivedAmount || 0);
    }

    if (!batch.shortAmount) {
      batch.shortAmount =
        Number(row.handoverShortAmount || 0);
    }

    batch.orders.push({
      id: String(row._id),
      order: row.order || null,
      orderNumber: row.orderNumber || "",
      amountCollected: amount,
      collectedAt: row.collectedAt || null,
      status: row.status,
    });
  }

  return Array.from(map.values()).sort(
    (a, b) =>
      new Date(
        b.submittedAt || b.verifiedAt || 0
      ).getTime() -
      new Date(
        a.submittedAt || a.verifiedAt || 0
      ).getTime()
  );
}

/**
 * GET /api/delivery/cash-handover/summary
 */
router.get(
  "/summary",
  async (req, res, next) => {
    try {
      const dateId =
        cleanText(req.query.date) ||
        getDateIdInIndia();

      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateId)) {
        return res.status(400).json({
          success: false,
          message: "Please select a valid date.",
        });
      }

      const range = getDayRangeInIndia(dateId);

      const rows = await CashCollection.find({
        collectedBy: req.user._id,

        status: {
          $in: [
            "collected",
            "submitted",
            "handed_over",
            "short_collected",
          ],
        },

        $or: [
          {
            collectedAt: {
              $gte: range.start,
              $lte: range.end,
            },
          },
          {
            handoverSubmittedAt: {
              $gte: range.start,
              $lte: range.end,
            },
          },
          {
            handoverVerifiedAt: {
              $gte: range.start,
              $lte: range.end,
            },
          },
        ],
      })
        .sort({
          collectedAt: -1,
          createdAt: -1,
        })
        .lean();

      const pendingRows = rows.filter(
        (row) => row.status === "collected"
      );

      const submittedRows = rows.filter(
        (row) => row.status === "submitted"
      );

      const verifiedRows = rows.filter((row) =>
        [
          "handed_over",
          "short_collected",
        ].includes(row.status)
      );

      const pendingSubmitAmount =
        pendingRows.reduce(
          (total, row) =>
            total + getRowAmount(row),
          0
        );

      const submittedAmount =
        submittedRows.reduce(
          (total, row) =>
            total + getRowAmount(row),
          0
        );

      const verifiedAmount =
        verifiedRows.reduce(
          (total, row) =>
            total +
            Number(
              row.handoverReceivedAmount ||
                getRowAmount(row)
            ),
          0
        );

      const shortAmount =
        verifiedRows.reduce(
          (total, row) =>
            total +
            Number(row.handoverShortAmount || 0),
          0
        );

      return res.status(200).json({
        success: true,

        data: {
          summary: {
            dateId,

            pendingSubmitCount:
              pendingRows.length,

            pendingSubmitAmount,

            submittedCount:
              submittedRows.length,

            submittedAmount,

            verifiedCount:
              verifiedRows.length,

            verifiedAmount,

            shortAmount,

            totalRows:
              rows.length,
          },

          pendingCollections:
            pendingRows,

          submittedBatches:
            buildBatchGroups(submittedRows),

          verifiedBatches:
            buildBatchGroups(verifiedRows),
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * POST /api/delivery/cash-handover/submit
 */
router.post(
  "/submit",
  async (req, res, next) => {
    try {
      const dateId =
        cleanText(req.body.dateId) ||
        getDateIdInIndia();

      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateId)) {
        return res.status(400).json({
          success: false,
          message: "Please select a valid date.",
        });
      }

      const range = getDayRangeInIndia(dateId);

      const pendingRows =
        await CashCollection.find({
          collectedBy: req.user._id,

          status: "collected",

          collectedAt: {
            $gte: range.start,
            $lte: range.end,
          },
        });

      if (pendingRows.length === 0) {
        return res.status(400).json({
          success: false,
          message:
            "There is no collected COD cash pending for handover.",
        });
      }

      const expectedAmount =
        pendingRows.reduce(
          (total, row) =>
            total + getRowAmount(row),
          0
        );

      const submittedAmount =
        parseAmount(
          req.body.amountSubmitted,
          expectedAmount
        );

      if (submittedAmount <= 0) {
        return res.status(400).json({
          success: false,
          message:
            "Submitted cash amount must be greater than zero.",
        });
      }

      const note =
        cleanText(req.body.note).slice(0, 800);

      const submittedAt =
        new Date();

      const batchId =
        `DCH-${dateId.replace(/-/g, "")}-${String(
          req.user._id
        ).slice(-6)}-${submittedAt
          .getTime()
          .toString(36)
          .toUpperCase()}`;

      const rowIds =
        pendingRows.map((row) => row._id);

      await CashCollection.updateMany(
        {
          _id: {
            $in: rowIds,
          },

          status: "collected",
        },
        {
          $set: {
            status: "submitted",

            deliveryHandoverBatchId:
              batchId,

            handoverDateId:
              dateId,

            handoverSubmittedAt:
              submittedAt,

            handoverSubmittedBy:
              req.user._id,

            handoverSubmittedBySnapshot:
              buildPartnerSnapshot(req.user),

            handoverExpectedAmount:
              expectedAmount,

            handoverSubmittedAmount:
              submittedAmount,

            handoverPartnerNote:
              note,
          },
        },
        {
          strict: false,
          runValidators: false,
        }
      );

      const updatedRows =
        await CashCollection.find({
          deliveryHandoverBatchId:
            batchId,
        }).lean();

      return res.status(200).json({
        success: true,

        message:
          "Cash handover submitted to admin for verification.",

        data: {
          batch: buildBatchGroups(
            updatedRows
          )[0] || {
            batchId,
            status: "submitted",
            expectedAmount,
            submittedAmount,
            orderCount:
              pendingRows.length,
            orders: [],
          },
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);

module.exports = router;