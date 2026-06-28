// backend/src/services/orderCheckout.js

const crypto = require("crypto");

const Order = require("../models/Order");
const Product = require(
  "../models/Product"
);

const ServiceableLocation = require(
  "../models/ServiceableLocation"
);

function createHttpError(
  message,
  statusCode = 400
) {
  const error = new Error(message);
  error.statusCode = statusCode;

  return error;
}

function cleanText(value) {
  return String(value || "").trim();
}

function cleanPhone(value) {
  return String(value || "").replace(
    /\D/g,
    ""
  );
}

function cleanPincode(value) {
  return String(value || "").replace(
    /\D/g,
    ""
  );
}

function validateAddress(address) {
  if (!address) {
    throw createHttpError(
      "Delivery address is required."
    );
  }

  if (
    cleanText(address.fullName).length <
    2
  ) {
    throw createHttpError(
      "A valid customer name is required."
    );
  }

  if (
    !/^[6-9]\d{9}$/.test(
      cleanPhone(address.phone)
    )
  ) {
    throw createHttpError(
      "A valid 10-digit Indian mobile number is required."
    );
  }

  if (
    cleanPincode(address.pincode)
      .length !== 6
  ) {
    throw createHttpError(
      "A valid six-digit pincode is required."
    );
  }

  if (
    cleanText(address.houseDetails)
      .length < 3
  ) {
    throw createHttpError(
      "House, flat or building details are required."
    );
  }

  if (
    cleanText(address.areaDetails)
      .length < 3
  ) {
    throw createHttpError(
      "Area and street details are required."
    );
  }
}

function validateSchedule(schedule) {
  if (
    !schedule ||
    !cleanText(
      schedule.deliveryDateId
    ) ||
    !cleanText(
      schedule.deliveryDateLabel
    ) ||
    !cleanText(
      schedule.deliverySlot
    )
  ) {
    throw createHttpError(
      "Delivery date and slot are required."
    );
  }
}

async function buildOrderDraft(
  requestBody,
  session
) {
  const requestedItems =
    requestBody.items;

  const deliveryAddress =
    requestBody.deliveryAddress;

  const deliverySchedule =
    requestBody.deliverySchedule;

  if (
    !Array.isArray(requestedItems) ||
    requestedItems.length === 0
  ) {
    throw createHttpError(
      "Add at least one bottle before placing an order."
    );
  }

  validateAddress(deliveryAddress);
  validateSchedule(deliverySchedule);

  const pincode = cleanPincode(
    deliveryAddress.pincode
  );

  const serviceableLocation =
    await ServiceableLocation.findOne({
      pincode,
      active: true,
    })
      .session(session)
      .lean();

  if (!serviceableLocation) {
    throw createHttpError(
      "Delivery is not available for this pincode."
    );
  }

  const quantitiesByProductId =
    new Map();

  for (const requestedItem of requestedItems) {
    const productId = cleanText(
      requestedItem.productId ||
        requestedItem.id
    ).toLowerCase();

    const quantity = Number(
      requestedItem.quantity
    );

    if (!productId) {
      throw createHttpError(
        "An order item is missing its product ID."
      );
    }

    if (
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 50
    ) {
      throw createHttpError(
        "Each bottle quantity must be between 1 and 50."
      );
    }

    quantitiesByProductId.set(
      productId,

      (quantitiesByProductId.get(
        productId
      ) || 0) + quantity
    );
  }

  const productIds = [
    ...quantitiesByProductId.keys(),
  ];

  const products =
    await Product.find({
      productId: {
        $in: productIds,
      },

      available: true,
    })
      .session(session)
      .lean();

  if (
    products.length !==
    productIds.length
  ) {
    throw createHttpError(
      "One or more selected bottles are unavailable."
    );
  }

  const productsById = new Map(
    products.map((product) => [
      product.productId,
      product,
    ])
  );

  const orderedProducts =
    productIds.map((productId) =>
      productsById.get(productId)
    );

  const items = orderedProducts.map(
    (product) => {
      const quantity =
        quantitiesByProductId.get(
          product.productId
        );

      return {
        product: product._id,
        productId:
          product.productId,
        name: product.name,
        shortName:
          product.shortName,
        sizeMl: product.sizeMl,
        price: product.price,
        quantity,

        lineTotal:
          product.price * quantity,
      };
    }
  );

  const subtotal = items.reduce(
    (sum, item) =>
      sum + item.lineTotal,
    0
  );

  if (
    subtotal <
    serviceableLocation.minimumOrder
  ) {
    throw createHttpError(
      `The minimum order for ${serviceableLocation.area} is ₹${serviceableLocation.minimumOrder}.`
    );
  }

  const deliveryFee =
    subtotal >= 399
      ? 0
      : serviceableLocation.deliveryFee;

  return {
    products: orderedProducts,
    quantitiesByProductId,

    draft: {
      items,

      deliveryAddress: {
        fullName: cleanText(
          deliveryAddress.fullName
        ),

        phone: cleanPhone(
          deliveryAddress.phone
        ),

        pincode,

        houseDetails: cleanText(
          deliveryAddress.houseDetails
        ),

        areaDetails: cleanText(
          deliveryAddress.areaDetails
        ),

        landmark: cleanText(
          deliveryAddress.landmark
        ),

        area:
          serviceableLocation.area,

        city:
          serviceableLocation.city,
      },

      deliverySchedule: {
        deliveryDateId: cleanText(
          deliverySchedule.deliveryDateId
        ),

        deliveryDateLabel:
          cleanText(
            deliverySchedule.deliveryDateLabel
          ),

        deliverySlot: cleanText(
          deliverySchedule.deliverySlot
        ),
      },

      subtotal,
      deliveryFee,

      total:
        subtotal + deliveryFee,
    },
  };
}

function generateOrderNumber() {
  const datePart = new Date()
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, "");

  const randomPart = crypto
    .randomBytes(3)
    .toString("hex")
    .toUpperCase();

  return `BO-${datePart}-${randomPart}`;
}

async function createUniqueOrderNumber(
  session
) {
  for (
    let attempt = 0;
    attempt < 5;
    attempt += 1
  ) {
    const orderNumber =
      generateOrderNumber();

    const exists = await Order.exists({
      orderNumber,
    }).session(session);

    if (!exists) {
      return orderNumber;
    }
  }

  throw new Error(
    "Unable to generate an order number."
  );
}

module.exports = {
  buildOrderDraft,
  cleanText,
  createHttpError,
  createUniqueOrderNumber,
};