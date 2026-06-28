// backend/src/server.js

require("dotenv").config();

const cors = require("cors");
const express = require("express");
const helmet = require("helmet");
const mongoose = require("mongoose");
const morgan = require("morgan");

const connectDB = require("./config/db");

const adminRoutes = require(
  "./routes/admin"
);

const authRoutes = require(
  "./routes/auth"
);

const locationRoutes = require(
  "./routes/locations"
);

const orderRoutes = require(
  "./routes/orders"
);

const productRoutes = require(
  "./routes/products"
);

const subscriptionRoutes = require(
  "./routes/subscriptions"
);

const app = express();

const PORT = Number(
  process.env.PORT || 5001
);

const allowedOrigins = String(
  process.env.CLIENT_ORIGINS || ""
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.disable("x-powered-by");

app.use(helmet());

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.length === 0) {
        return callback(null, true);
      }

      if (
        allowedOrigins.includes(origin)
      ) {
        return callback(null, true);
      }

      const error = new Error(
        `Origin ${origin} is not permitted by CORS.`
      );

      error.statusCode = 403;

      return callback(error);
    },

    credentials: true,
  })
);

app.use(
  express.json({
    limit: "1mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
  })
);

if (
  process.env.NODE_ENV !== "test"
) {
  app.use(morgan("dev"));
}

app.get("/api/health", (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Backend is running.",

    environment:
      process.env.NODE_ENV ||
      "development",

    database:
      mongoose.connection.name ||
      null,

    timestamp:
      new Date().toISOString(),
  });
});

app.use(
  "/api/auth",
  authRoutes
);

app.use(
  "/api/products",
  productRoutes
);

app.use(
  "/api/locations",
  locationRoutes
);

app.use(
  "/api/orders",
  orderRoutes
);

app.use(
  "/api/subscriptions",
  subscriptionRoutes
);

app.use(
  "/api/admin",
  adminRoutes
);

app.use((req, res) => {
  return res.status(404).json({
    success: false,

    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

app.use(
  (error, req, res, next) => {
    console.error(error);

    if (error.code === 11000) {
      const duplicateField =
        Object.keys(
          error.keyPattern || {}
        )[0] || "field";

      return res.status(409).json({
        success: false,

        message: `A record already exists with this ${duplicateField}.`,
      });
    }

    const statusCode =
      error.statusCode ||
      (error.name ===
      "ValidationError"
        ? 400
        : 500);

    return res.status(statusCode).json({
      success: false,

      message:
        statusCode === 500
          ? "An unexpected server error occurred."
          : error.message,

      ...(process.env.NODE_ENV ===
      "development"
        ? {
            stack: error.stack,
          }
        : {}),
    });
  }
);

async function startServer() {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(
        `Backend running on port ${PORT}`
      );
    });
  } catch (error) {
    console.error(
      "Unable to start backend:",
      error.message
    );

    process.exit(1);
  }
}

startServer();