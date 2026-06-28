// backend/src/seed/seedDatabase.js

require("dotenv").config();

const mongoose = require("mongoose");

const connectDB = require("../config/db");
const Product = require("../models/Product");
const ServiceableLocation = require(
  "../models/ServiceableLocation"
);

const products = [
  {
    productId: "coconut-chia-refresh",
    name: "Coconut Chia Refresh",
    shortName: "Coconut",
    description:
      "A light and refreshing coconut-water blend with fresh fruit and chia seeds.",
    ingredients: [
      "Coconut water",
      "Fresh fruit",
      "Chia seeds",
    ],
    sizeMl: 300,
    price: 99,
    category: "Hydrating",
    imageUrl: "",
    liquidColor: "#DDEDDC",
    cardColor: "#EEF6EE",
    accentColor: "#32694B",
    subscriptionEligible: true,
    available: true,
    sortOrder: 1,
  },

  {
    productId: "cane-chia-splash",
    name: "Cane Chia Splash",
    shortName: "Cane Chia",
    description:
      "Naturally sweet sugarcane juice balanced with fruit pieces and chia seeds.",
    ingredients: [
      "Sugarcane juice",
      "Fresh fruit",
      "Chia seeds",
    ],
    sizeMl: 300,
    price: 89,
    category: "Hydrating",
    imageUrl: "",
    liquidColor: "#DCE5A5",
    cardColor: "#F3F6E3",
    accentColor: "#647729",
    subscriptionEligible: true,
    available: true,
    sortOrder: 2,
  },

  {
    productId: "watermelon-splash",
    name: "Watermelon Splash",
    shortName: "Watermelon",
    description:
      "Fresh watermelon juice with juicy fruit pieces and soaked chia seeds.",
    ingredients: [
      "Watermelon juice",
      "Fruit pieces",
      "Chia seeds",
    ],
    sizeMl: 300,
    price: 109,
    category: "Fruity",
    imageUrl: "",
    liquidColor: "#EF8F8B",
    cardColor: "#FDECEA",
    accentColor: "#A94443",
    subscriptionEligible: true,
    available: true,
    sortOrder: 3,
  },

  {
    productId: "pineapple-punch",
    name: "Pineapple Punch",
    shortName: "Pineapple",
    description:
      "A bright tropical pineapple drink with fruit pieces and chia seeds.",
    ingredients: [
      "Pineapple juice",
      "Fruit pieces",
      "Chia seeds",
    ],
    sizeMl: 300,
    price: 109,
    category: "Fruity",
    imageUrl: "",
    liquidColor: "#F2C957",
    cardColor: "#FFF5D9",
    accentColor: "#8D680C",
    subscriptionEligible: true,
    available: true,
    sortOrder: 4,
  },
];

const serviceableLocations = [
  {
    pincode: "500081",
    area: "Madhapur",
    city: "Hyderabad",
    active: true,
    deliveryFee: 39,
    minimumOrder: 99,
    sortOrder: 1,
  },

  {
    pincode: "500084",
    area: "Kondapur",
    city: "Hyderabad",
    active: true,
    deliveryFee: 39,
    minimumOrder: 99,
    sortOrder: 2,
  },

  {
    pincode: "500032",
    area: "Gachibowli",
    city: "Hyderabad",
    active: true,
    deliveryFee: 39,
    minimumOrder: 99,
    sortOrder: 3,
  },

  {
    pincode: "500033",
    area: "Jubilee Hills",
    city: "Hyderabad",
    active: true,
    deliveryFee: 49,
    minimumOrder: 149,
    sortOrder: 4,
  },
];

async function seedProducts() {
  const operations = products.map((product) => ({
    updateOne: {
      filter: {
        productId: product.productId,
      },
      update: {
        $setOnInsert: product,
      },
      upsert: true,
    },
  }));

  const result = await Product.bulkWrite(
    operations
  );

  console.log(
    `Products seeded. New products: ${result.upsertedCount}`
  );
}

async function seedLocations() {
  const operations = serviceableLocations.map(
    (location) => ({
      updateOne: {
        filter: {
          pincode: location.pincode,
        },
        update: {
          $setOnInsert: location,
        },
        upsert: true,
      },
    })
  );

  const result =
    await ServiceableLocation.bulkWrite(
      operations
    );

  console.log(
    `Locations seeded. New locations: ${result.upsertedCount}`
  );
}

async function seedDatabase() {
  try {
    await connectDB();

    await seedProducts();
    await seedLocations();

    console.log(
      "Initial database setup completed successfully."
    );
  } catch (error) {
    console.error(
      "Database seeding failed:",
      error.message
    );

    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
}

seedDatabase();