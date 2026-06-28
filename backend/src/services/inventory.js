// backend/src/services/inventory.js

const Product = require(
  "../models/Product"
);

function createInventoryError(message) {
  const error = new Error(message);
  error.statusCode = 409;

  return error;
}

async function reserveProductInventory({
  products,
  quantitiesByProductId,
  session,
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
              currentStock === 1
                ? ""
                : "s"
            } of ${product.name} are available.`
      );
    }

    const result =
      await Product.updateOne(
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

async function restoreOrderInventory({
  order,
  session,
}) {
  if (
    !order.inventoryReserved ||
    order.inventoryRestored
  ) {
    return false;
  }

  const operations = order.items.map(
    (item) => ({
      updateOne: {
        filter: {
          _id: item.product,
        },

        update: {
          $inc: {
            stockQuantity:
              item.quantity,
          },
        },
      },
    })
  );

  if (operations.length > 0) {
    await Product.bulkWrite(
      operations,
      {
        session,
      }
    );
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