const Product = require("../models/Product");
const InventoryMovement = require("../models/InventoryMovement");

function createInventoryError(message, statusCode = 409) {
  const error = new Error(message);
  error.statusCode = statusCode;

  return error;
}

function cleanText(value) {
  return String(value ?? "").trim();
}

function getObjectId(value) {
  if (!value) {
    return null;
  }

  if (value._id) {
    return value._id;
  }

  return value;
}

function getActorSnapshot(actor) {
  if (!actor) {
    return null;
  }

  return {
    fullName:
      cleanText(actor.fullName) ||
      cleanText(actor.name),

    email:
      cleanText(actor.email).toLowerCase(),

    role:
      cleanText(actor.role),
  };
}

function getInventoryItems(record) {
  if (Array.isArray(record?.items)) {
    return record.items;
  }

  if (Array.isArray(record?.orderDraft?.items)) {
    return record.orderDraft.items;
  }

  return [];
}

function inferRecordSource(record) {
  if (record?.orderNumber) {
    return {
      sourceType: "order",
      source: "order",
      order: getObjectId(record),
      orderNumber: cleanText(record.orderNumber),
      paymentSession: null,
    };
  }

  if (
    record?.razorpayOrderId ||
    record?.orderDraft
  ) {
    return {
      sourceType: "payment_session",
      source: "payment_session",
      order: null,
      orderNumber: "",
      paymentSession: getObjectId(record),
    };
  }

  return {
    sourceType: "system",
    source: "system",
    order: null,
    orderNumber: "",
    paymentSession: null,
  };
}

async function createInventoryMovement({
  product,
  movementType,
  direction,
  quantityChange,
  stockBefore,
  stockAfter,
  lowStockThresholdBefore = null,
  lowStockThresholdAfter = null,
  source = "",
  sourceType = "",
  order = null,
  orderNumber = "",
  paymentSession = null,
  actor = null,
  reason = "",
  metadata = {},
  session,
}) {
  await InventoryMovement.create(
    [
      {
        product:
          product._id,

        productId:
          product.productId,

        productName:
          product.name,

        movementType,
        direction,
        quantityChange,
        stockBefore,
        stockAfter,
        lowStockThresholdBefore,
        lowStockThresholdAfter,
        source,
        sourceType,
        order,
        orderNumber,
        paymentSession,
        actor:
          actor?._id ||
          actor ||
          null,

        actorSnapshot:
          getActorSnapshot(actor),

        reason:
          cleanText(reason),

        metadata,
      },
    ],
    {
      session,
    }
  );
}

async function reserveProductInventory({
  products,
  quantitiesByProductId,
  session,
  source = "stock_reserved",
  sourceType = "system",
  actor = null,
  reason = "Stock reserved for checkout.",
  metadata = {},
}) {
  for (const product of products) {
    const quantity =
      quantitiesByProductId.get(
        product.productId
      );

    if (
      !Number.isInteger(quantity) ||
      quantity < 1
    ) {
      throw createInventoryError(
        `Invalid quantity for ${product.name}.`
      );
    }

    const currentStock = Number(
      product.stockQuantity ?? 0
    );

    if (currentStock < quantity) {
      throw createInventoryError(
        currentStock <= 0
          ? `${product.name} is currently out of stock.`
          : `Only ${currentStock} bottle${
              currentStock === 1 ? "" : "s"
            } of ${product.name} are available.`
      );
    }

    const stockBeforeProduct =
      await Product.findOneAndUpdate(
        {
          _id: product._id,
          available: true,

          stockQuantity: {
            $gte: quantity,
          },
        },

        {
          $inc: {
            stockQuantity:
              -quantity,
          },
        },

        {
          new: false,
          session,
        }
      );

    if (!stockBeforeProduct) {
      throw createInventoryError(
        `${product.name} stock changed while the order was being placed. Please refresh your cart and try again.`
      );
    }

    const stockBefore =
      Number(
        stockBeforeProduct.stockQuantity ??
          0
      );

    const stockAfter =
      stockBefore - quantity;

    await createInventoryMovement({
      product:
        stockBeforeProduct,

      movementType:
        "reserve",

      direction:
        "out",

      quantityChange:
        -quantity,

      stockBefore,
      stockAfter,

      lowStockThresholdBefore:
        stockBeforeProduct.lowStockThreshold,

      lowStockThresholdAfter:
        stockBeforeProduct.lowStockThreshold,

      source,
      sourceType,
      actor,
      reason,

      metadata: {
        ...metadata,
        quantity,
      },

      session,
    });
  }
}

async function restoreOrderInventory({
  order,
  session,
  source = "",
  sourceType = "",
  actor = null,
  reason = "",
  metadata = {},
}) {
  if (!order?.inventoryReserved) {
    return false;
  }

  if (order.inventoryRestored) {
    return false;
  }

  const items = getInventoryItems(order);

  if (items.length === 0) {
    throw createInventoryError(
      "Reserved inventory cannot be restored because the order items are missing.",
      500
    );
  }

  const quantitiesByProduct =
    new Map();

  for (const item of items) {
    const productId = String(
      item?.product?._id ??
        item?.product ??
        ""
    ).trim();

    const quantity =
      Number(item?.quantity);

    if (
      !productId ||
      !Number.isInteger(quantity) ||
      quantity < 1
    ) {
      throw createInventoryError(
        "Reserved inventory contains an invalid product or quantity.",
        500
      );
    }

    quantitiesByProduct.set(
      productId,

      (quantitiesByProduct.get(
        productId
      ) || 0) + quantity
    );
  }

  const inferredSource =
    inferRecordSource(order);

  const movementSource =
    source ||
    `${
      inferredSource.source
    }_stock_restored`;

  const movementSourceType =
    sourceType ||
    inferredSource.sourceType;

  const movementReason =
    cleanText(reason) ||
    cleanText(
      order.cancellationReason
    ) ||
    cleanText(
      order.failureReason
    ) ||
    "Reserved stock restored.";

  for (const [
    productId,
    quantity,
  ] of quantitiesByProduct.entries()) {
    const productBefore =
      await Product.findByIdAndUpdate(
        productId,

        {
          $inc: {
            stockQuantity:
              quantity,
          },
        },

        {
          new: false,
          session,
        }
      );

    if (!productBefore) {
      throw createInventoryError(
        "One or more reserved products could not be found while restoring stock.",
        500
      );
    }

    const stockBefore =
      Number(
        productBefore.stockQuantity ??
          0
      );

    const stockAfter =
      stockBefore + quantity;

    await createInventoryMovement({
      product:
        productBefore,

      movementType:
        "restore",

      direction:
        "in",

      quantityChange:
        quantity,

      stockBefore,
      stockAfter,

      lowStockThresholdBefore:
        productBefore.lowStockThreshold,

      lowStockThresholdAfter:
        productBefore.lowStockThreshold,

      source:
        movementSource,

      sourceType:
        movementSourceType,

      order:
        inferredSource.order,

      orderNumber:
        inferredSource.orderNumber,

      paymentSession:
        inferredSource.paymentSession,

      actor,
      reason:
        movementReason,

      metadata: {
        ...metadata,
        quantity,
      },

      session,
    });
  }

  order.inventoryRestored = true;
  order.inventoryRestoredAt =
    new Date();

  return true;
}

module.exports = {
  reserveProductInventory,
  restoreOrderInventory,
};