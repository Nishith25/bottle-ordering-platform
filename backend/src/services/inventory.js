const Product = require("../models/Product");

function createInventoryError(message, statusCode = 409) {
  const error = new Error(message);
  error.statusCode = statusCode;

  return error;
}

/*
 * A completed Order stores items in order.items.
 *
 * A pending Razorpay PaymentSession stores items in:
 * paymentSession.orderDraft.items.
 */
function getInventoryItems(record) {
  if (Array.isArray(record?.items)) {
    return record.items;
  }

  if (Array.isArray(record?.orderDraft?.items)) {
    return record.orderDraft.items;
  }

  return [];
}

async function reserveProductInventory({
  products,
  quantitiesByProductId,
  session,
}) {
  for (const product of products) {
    const quantity = quantitiesByProductId.get(
      product.productId
    );

    if (!Number.isInteger(quantity) || quantity < 1) {
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

    const result = await Product.updateOne(
      {
        _id: product._id,
        available: true,
        stockQuantity: {
          $gte: quantity,
        },
      },

      {
        $inc: {
          stockQuantity: -quantity,
        },
      },

      {
        session,
      }
    );

    if (result.modifiedCount !== 1) {
      throw createInventoryError(
        `${product.name} stock changed while the order was being placed. Please refresh your cart and try again.`
      );
    }
  }
}

/**
 * Restores stock that was reserved for an Order or PaymentSession.
 *
 * Idempotency is provided by:
 *
 * - inventoryReserved
 * - inventoryRestored
 *
 * The caller must save the record inside the same MongoDB transaction
 * after this function updates those fields.
 */
async function restoreOrderInventory({
  order,
  session,
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

  const quantitiesByProduct = new Map();

  for (const item of items) {
    const productId = String(
      item?.product?._id ??
        item?.product ??
        ""
    ).trim();

    const quantity = Number(item?.quantity);

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
      (quantitiesByProduct.get(productId) || 0) + quantity
    );
  }

  const operations = [
    ...quantitiesByProduct.entries(),
  ].map(([productId, quantity]) => ({
    updateOne: {
      filter: {
        _id: productId,
      },

      update: {
        $inc: {
          stockQuantity: quantity,
        },
      },
    },
  }));

  if (operations.length > 0) {
    const result = await Product.bulkWrite(
      operations,
      {
        session,
        ordered: true,
      }
    );

    const matchedCount =
      Number(result.matchedCount ?? result.nMatched ?? 0);

    if (matchedCount !== operations.length) {
      throw createInventoryError(
        "One or more reserved products could not be found while restoring stock.",
        500
      );
    }
  }

  order.inventoryRestored = true;
  order.inventoryRestoredAt = new Date();

  return true;
}

module.exports = {
  reserveProductInventory,
  restoreOrderInventory,
};