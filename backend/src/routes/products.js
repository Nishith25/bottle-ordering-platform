// backend/src/routes/products.js

const express = require("express");

const Product = require("../models/Product");

const router = express.Router();

/**
 * GET /api/products
 * Returns products currently available to customers.
 */
router.get("/", async (req, res, next) => {
  try {
    const products = await Product.find({
      available: true,
    })
      .sort({
        sortOrder: 1,
        createdAt: 1,
      })
      .lean();

    return res.status(200).json({
      success: true,
      count: products.length,
      data: products,
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /api/products/:productId
 * Returns one product using its public product ID.
 */
router.get("/:productId", async (req, res, next) => {
  try {
    const productId = String(
      req.params.productId
    ).toLowerCase();

    const product = await Product.findOne({
      productId,
      available: true,
    }).lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Bottle not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;