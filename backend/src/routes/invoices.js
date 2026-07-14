const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const {
  protect,
} = require("../middleware/auth");

const Order = require("../models/Order");

const router = express.Router();

const PRINT_TOKEN_EXPIRES_IN =
  "15m";

function cleanText(value) {
  return String(value ?? "").trim();
}

function escapeHtml(value) {
  return cleanText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatCurrency(value) {
  return new Intl.NumberFormat(
    "en-IN",
    {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }
  ).format(Number(value || 0));
}

function formatDateTime(value) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "en-IN",
    {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Kolkata",
    }
  ).format(new Date(value));
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "en-IN",
    {
      dateStyle: "medium",
      timeZone: "Asia/Kolkata",
    }
  ).format(new Date(value));
}

function getDateIdInIst(date = new Date()) {
  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).format(date);
}

function getOrderRefQuery(orderRef) {
  const cleanRef =
    cleanText(orderRef);

  if (
    mongoose.Types.ObjectId.isValid(
      cleanRef
    )
  ) {
    return {
      _id: cleanRef,
    };
  }

  return {
    orderNumber: cleanRef,
  };
}

function getBrandDetails() {
  return {
    name:
      cleanText(
        process.env.BRAND_NAME
      ) || "SolidSip",

    legalName:
      cleanText(
        process.env.BUSINESS_LEGAL_NAME
      ) || "",

    supportEmail:
      cleanText(
        process.env.BRAND_SUPPORT_EMAIL
      ) || "",

    phone:
      cleanText(
        process.env.BRAND_PHONE
      ) || "",

    address:
      cleanText(
        process.env.BUSINESS_ADDRESS
      ) || "",

    fssai:
      cleanText(
        process.env.FSSAI_LICENSE_NUMBER
      ) || "",

    gstin:
      cleanText(
        process.env.GSTIN
      ) || "",
  };
}

function getCustomerName(order) {
  return (
    cleanText(order.customerSnapshot?.fullName) ||
    cleanText(order.customerSnapshot?.name) ||
    cleanText(order.deliveryAddress?.fullName) ||
    cleanText(order.deliveryAddress?.name) ||
    cleanText(order.user?.fullName) ||
    cleanText(order.user?.name) ||
    "Customer"
  );
}

function getCustomerPhone(order) {
  return (
    cleanText(order.deliveryAddress?.phone) ||
    cleanText(order.customerSnapshot?.phone) ||
    cleanText(order.user?.phone) ||
    cleanText(order.user?.mobile) ||
    ""
  );
}

function formatAddress(address) {
  if (!address) {
    return "";
  }

  if (typeof address === "string") {
    return cleanText(address);
  }

  const parts = [
    address.flat,
    address.house,
    address.houseNumber,
    address.apartment,
    address.building,
    address.street,
    address.area,
    address.landmark
      ? `Landmark: ${address.landmark}`
      : "",
    address.city,
    address.state,
    address.pincode,
  ]
    .map(cleanText)
    .filter(Boolean);

  return parts.join(", ");
}

function getCustomerAddress(order) {
  return (
    formatAddress(
      order.deliveryAddress
    ) ||
    formatAddress(order.address) ||
    cleanText(order.customerAddress) ||
    ""
  );
}

function formatMinutesToTime(minutes) {
  const numberValue =
    Number(minutes);

  if (
    !Number.isFinite(numberValue) ||
    numberValue < 0
  ) {
    return "";
  }

  const hours =
    Math.floor(numberValue / 60);

  const mins =
    numberValue % 60;

  const suffix =
    hours >= 12 ? "PM" : "AM";

  const hour12 =
    hours % 12 || 12;

  return `${hour12}:${String(mins).padStart(2, "0")} ${suffix}`;
}

function getDeliverySlotLabel(order) {
  const schedule =
    order.deliverySchedule || {};

  const directLabel =
    cleanText(schedule.slotLabel) ||
    cleanText(schedule.deliverySlotLabel) ||
    cleanText(schedule.label) ||
    cleanText(schedule.slotName) ||
    cleanText(order.deliverySlotLabel);

  if (directLabel) {
    return directLabel;
  }

  const nestedSlot =
    schedule.slot &&
    typeof schedule.slot === "object"
      ? schedule.slot
      : null;

  const nestedLabel =
    cleanText(nestedSlot?.label) ||
    cleanText(nestedSlot?.slotLabel) ||
    cleanText(nestedSlot?.name);

  if (nestedLabel) {
    return nestedLabel;
  }

  const startMinutes =
    schedule.startMinutes ??
    schedule.deliverySlotStartMinutes ??
    nestedSlot?.startMinutes;

  const endMinutes =
    schedule.endMinutes ??
    schedule.deliverySlotEndMinutes ??
    nestedSlot?.endMinutes;

  const startLabel =
    formatMinutesToTime(startMinutes);

  const endLabel =
    formatMinutesToTime(endMinutes);

  if (startLabel && endLabel) {
    return `${startLabel} – ${endLabel}`;
  }

  return (
    cleanText(schedule.slotCode) ||
    cleanText(schedule.deliverySlotCode) ||
    cleanText(nestedSlot?.code) ||
    "Slot not selected"
  );
}

function getLineTotal(item) {
  const lineTotal =
    Number(item.lineTotal || 0);

  if (
    Number.isFinite(lineTotal) &&
    lineTotal > 0
  ) {
    return lineTotal;
  }

  return (
    Number(item.price || 0) *
    Number(item.quantity || 0)
  );
}

function getInvoiceNumber(order) {
  const dateId =
    getDateIdInIst(
      new Date(
        order.createdAt || Date.now()
      )
    ).replace(/-/g, "");

  const orderNumber =
    cleanText(order.orderNumber);

  const orderPart =
    orderNumber
      ? orderNumber
          .replace(/^BO-\d{8}-/i, "")
          .replace(/^BO-/i, "")
          .toUpperCase()
      : String(order._id)
          .slice(-8)
          .toUpperCase();

  return `SS-${dateId}-${orderPart}`;
}

function normalizeInvoice(order) {
  const brand =
    getBrandDetails();

  const items =
    (order.items || []).map(
      (item) => {
        const quantity =
          Number(item.quantity || 0);

        const price =
          Number(item.price || 0);

        return {
          productId:
            cleanText(item.productId) ||
            cleanText(item.product),

          name:
            cleanText(item.name) ||
            cleanText(item.productName) ||
            "Bottle",

          shortName:
            cleanText(item.shortName) ||
            cleanText(item.name) ||
            "Bottle",

          sizeMl:
            Number(item.sizeMl || 0),

          quantity,

          price,

          lineTotal:
            getLineTotal(item),
        };
      }
    );

  const bottleCount =
    items.reduce(
      (total, item) =>
        total +
        Number(item.quantity || 0),
      0
    );

  return {
    invoiceNumber:
      getInvoiceNumber(order),

    invoiceDate:
      new Date().toISOString(),

    orderId:
      String(order._id),

    orderNumber:
      order.orderNumber,

    orderDate:
      order.createdAt,

    brand,

    customer: {
      name:
        getCustomerName(order),

      phone:
        getCustomerPhone(order),

      address:
        getCustomerAddress(order),
    },

    delivery: {
      dateId:
        cleanText(
          order.deliverySchedule?.deliveryDateId
        ),

      slotLabel:
        getDeliverySlotLabel(order),
    },

    payment: {
      method:
        order.paymentMethod || "cod",

      status:
        order.paymentStatus || "pending",
    },

    status: {
      order:
        order.orderStatus,

      delivery:
        order.deliveryStatus,
    },

    items,

    totals: {
      bottleCount,

      subtotal:
        Number(order.subtotal || 0),

      deliveryFee:
        Number(order.deliveryFee || 0),

      couponDiscount:
        Number(order.couponDiscount || 0),

      total:
        Number(order.total || 0),
    },
  };
}

async function findOrderForInvoice(orderRef) {
  const order =
    await Order.findOne(
      getOrderRefQuery(orderRef)
    )
      .populate({
        path: "user",
        select:
          "fullName name email phone mobile",
        options: {
          strictPopulate: false,
        },
      })
      .lean();

  return order;
}

function canAccessInvoice(
  user,
  order
) {
  if (!user || !order) {
    return false;
  }

  if (user.role === "admin") {
    return true;
  }

  const userId =
    String(user._id || "");

  const orderUserId =
    String(
      order.user?._id ||
        order.user ||
        ""
    );

  return (
    userId &&
    orderUserId &&
    userId === orderUserId
  );
}

function createPrintToken({
  orderRef,
  user,
}) {
  const secret =
    process.env.JWT_SECRET;

  if (!secret) {
    const error = new Error(
      "Invoice print is not configured."
    );

    error.statusCode = 500;
    throw error;
  }

  return jwt.sign(
    {
      type: "invoice_print",
      orderRef,
      userId:
        String(user._id),
      role:
        user.role || "customer",
    },
    secret,
    {
      expiresIn:
        PRINT_TOKEN_EXPIRES_IN,
    }
  );
}

function buildInvoiceHtml(invoice) {
  const brand =
    invoice.brand;

  const optionalBusinessLines = [
    brand.legalName,
    brand.address,
    brand.phone
      ? `Phone: ${brand.phone}`
      : "",
    brand.supportEmail
      ? `Email: ${brand.supportEmail}`
      : "",
    brand.fssai
      ? `FSSAI: ${brand.fssai}`
      : "",
    brand.gstin
      ? `GSTIN: ${brand.gstin}`
      : "",
  ]
    .filter(Boolean)
    .map(
      (line) =>
        `<div>${escapeHtml(line)}</div>`
    )
    .join("");

  const itemRows =
    invoice.items
      .map(
        (item, index) => `
          <tr>
            <td class="serial-cell">${index + 1}</td>
            <td class="item-cell">
              <strong>${escapeHtml(item.name)}</strong>
              <span>${item.sizeMl ? `${escapeHtml(item.sizeMl)} ml` : ""}</span>
            </td>
            <td class="qty-cell">${escapeHtml(item.quantity)}</td>
            <td class="money-cell">${escapeHtml(formatCurrency(item.price))}</td>
            <td class="money-cell">${escapeHtml(formatCurrency(item.lineTotal))}</td>
          </tr>
        `
      )
      .join("");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Invoice ${escapeHtml(invoice.invoiceNumber)}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />

  <style>
    * {
      box-sizing: border-box;
    }

    html,
    body {
      width: 100%;
      max-width: 100%;
      margin: 0;
      overflow-x: hidden;
    }

    body {
      padding: 16px;
      background: #f3f7f4;
      color: #17251d;
      font-family: Arial, Helvetica, sans-serif;
      -webkit-text-size-adjust: 100%;
    }

    .print-actions {
      width: 100%;
      max-width: 860px;
      margin: 0 auto 12px;
      text-align: right;
    }

    button {
      min-height: 42px;
      padding: 0 18px;
      border: 0;
      border-radius: 12px;
      background: #155d3e;
      color: #ffffff;
      font-weight: 800;
      cursor: pointer;
    }

    .invoice-page {
      width: 100%;
      max-width: 860px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #dfe8e2;
      border-radius: 18px;
      overflow: hidden;
      box-shadow: 0 24px 60px rgba(20, 50, 32, 0.10);
    }

    .invoice-header {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 24px;
      padding: 28px;
      background: #0f3b26;
      color: #ffffff;
    }

    .brand h1 {
      margin: 0 0 8px;
      font-size: 30px;
      line-height: 1.1;
      word-break: break-word;
    }

    .brand div {
      margin-top: 4px;
      color: #d7eadc;
      font-size: 12px;
      line-height: 1.45;
    }

    .invoice-title {
      text-align: right;
    }

    .invoice-title h2 {
      margin: 0 0 8px;
      font-size: 26px;
      line-height: 1.1;
    }

    .invoice-title strong {
      display: block;
      color: #d7eadc;
      font-size: 14px;
      line-height: 1.45;
      word-break: break-word;
    }

    .invoice-title p {
      margin: 8px 0 0;
      color: #d7eadc;
    }

    .section {
      padding: 24px 28px;
      border-bottom: 1px solid #e7eee9;
    }

    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
    }

    .label {
      color: #65736b;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    h3 {
      margin: 8px 0 8px;
      font-size: 16px;
      line-height: 1.35;
      word-break: break-word;
    }

    p {
      margin: 4px 0;
      color: #52625a;
      font-size: 13px;
      line-height: 1.5;
      word-break: break-word;
    }

    .table-wrap {
      width: 100%;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }

    th {
      padding: 12px 10px;
      background: #f5faf6;
      color: #65736b;
      font-size: 10px;
      text-align: left;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      border-bottom: 1px solid #e1e9e4;
      white-space: nowrap;
    }

    td {
      padding: 13px 10px;
      color: #1d2b23;
      font-size: 13px;
      border-bottom: 1px solid #edf2ef;
      vertical-align: top;
      word-break: break-word;
    }

    td strong {
      display: block;
      line-height: 1.25;
    }

    td span {
      display: block;
      margin-top: 4px;
      color: #748078;
      font-size: 11px;
    }

    .serial-cell {
      width: 38px;
    }

    .item-cell {
      width: 34%;
    }

    .qty-cell {
      width: 54px;
      text-align: center;
    }

    .money-cell {
      width: 88px;
      text-align: right;
      white-space: nowrap;
    }

    .totals {
      display: grid;
      justify-content: end;
      gap: 8px;
      padding: 20px 28px;
      border-bottom: 1px solid #e7eee9;
    }

    .total-row {
      display: grid;
      grid-template-columns: minmax(120px, 180px) minmax(90px, 140px);
      gap: 18px;
      align-items: center;
      font-size: 14px;
    }

    .total-row span:first-child {
      color: #607067;
    }

    .total-row strong {
      text-align: right;
      white-space: nowrap;
    }

    .grand-total {
      margin-top: 6px;
      padding-top: 12px;
      border-top: 2px solid #173f2a;
      font-size: 20px;
      font-weight: 900;
    }

    .invoice-footer {
      padding: 18px 28px 28px;
      color: #64736a;
      font-size: 12px;
      line-height: 1.6;
    }

    @media (max-width: 640px) {
      body {
        padding: 10px;
      }

      .print-actions {
        padding: 0;
      }

      .print-actions button {
        width: 100%;
      }

      .invoice-page {
        border-radius: 16px;
      }

      .invoice-header {
        grid-template-columns: 1fr;
        gap: 18px;
        padding: 22px;
      }

      .brand h1 {
        font-size: 28px;
      }

      .invoice-title {
        text-align: left;
      }

      .invoice-title h2 {
        font-size: 24px;
      }

      .section {
        padding: 20px 18px;
      }

      .grid-2 {
        grid-template-columns: 1fr;
        gap: 20px;
      }

      table {
        table-layout: fixed;
      }

      th {
        padding: 10px 6px;
        font-size: 9px;
        letter-spacing: 0.04em;
      }

      td {
        padding: 12px 6px;
        font-size: 12px;
      }

      td span {
        font-size: 10px;
      }

      .serial-cell {
        width: 28px;
      }

      .item-cell {
        width: 38%;
      }

      .qty-cell {
        width: 38px;
      }

      .money-cell {
        width: 70px;
        font-size: 12px;
      }

      .totals {
        justify-content: stretch;
        padding: 18px;
      }

      .total-row {
        grid-template-columns: 1fr auto;
        gap: 12px;
        width: 100%;
      }

      .grand-total {
        font-size: 19px;
      }

      .invoice-footer {
        padding: 18px;
      }
    }

    @media (max-width: 380px) {
      body {
        padding: 8px;
      }

      .invoice-header {
        padding: 20px 16px;
      }

      .brand h1 {
        font-size: 25px;
      }

      .invoice-title h2 {
        font-size: 22px;
      }

      .section {
        padding: 18px 14px;
      }

      th {
        font-size: 8px;
        padding: 9px 4px;
      }

      td {
        font-size: 11px;
        padding: 11px 4px;
      }

      .item-cell {
        width: 40%;
      }

      .money-cell {
        width: 64px;
      }

      .totals {
        padding: 16px 14px;
      }

      .invoice-footer {
        padding: 16px 14px 20px;
      }
    }

    @media print {
      @page {
        size: A4;
        margin: 12mm;
      }

      html,
      body {
        overflow: visible;
      }

      body {
        padding: 0;
        background: #ffffff;
      }

      .print-actions {
        display: none;
      }

      .invoice-page {
        max-width: none;
        border: 0;
        border-radius: 0;
        box-shadow: none;
      }

      .invoice-header {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>

<body>
  <div class="print-actions">
    <button onclick="window.print()">Print / Save as PDF</button>
  </div>

  <main class="invoice-page">
    <header class="invoice-header">
      <div class="brand">
        <h1>${escapeHtml(brand.name)}</h1>
        ${optionalBusinessLines}
      </div>

      <div class="invoice-title">
        <h2>Invoice</h2>
        <strong>${escapeHtml(invoice.invoiceNumber)}</strong>
        <p>${escapeHtml(formatDate(invoice.invoiceDate))}</p>
      </div>
    </header>

    <section class="section grid-2">
      <div>
        <div class="label">Billed to</div>
        <h3>${escapeHtml(invoice.customer.name)}</h3>
        <p>${escapeHtml(invoice.customer.phone || "No phone")}</p>
        <p>${escapeHtml(invoice.customer.address || "No address")}</p>
      </div>

      <div>
        <div class="label">Order details</div>
        <h3>${escapeHtml(invoice.orderNumber)}</h3>
        <p>Order date: ${escapeHtml(formatDateTime(invoice.orderDate))}</p>
        <p>Delivery: ${escapeHtml(invoice.delivery.slotLabel)}</p>
        <p>Payment: ${escapeHtml(invoice.payment.method)} · ${escapeHtml(invoice.payment.status)}</p>
      </div>
    </section>

    <section class="section">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th class="serial-cell">#</th>
              <th class="item-cell">Item</th>
              <th class="qty-cell">Qty</th>
              <th class="money-cell">Rate</th>
              <th class="money-cell">Amount</th>
            </tr>
          </thead>

          <tbody>
            ${itemRows}
          </tbody>
        </table>
      </div>
    </section>

    <section class="totals">
      <div class="total-row">
        <span>Subtotal</span>
        <strong>${escapeHtml(formatCurrency(invoice.totals.subtotal))}</strong>
      </div>

      <div class="total-row">
        <span>Delivery fee</span>
        <strong>${escapeHtml(formatCurrency(invoice.totals.deliveryFee))}</strong>
      </div>

      <div class="total-row">
        <span>Discount</span>
        <strong>-${escapeHtml(formatCurrency(invoice.totals.couponDiscount))}</strong>
      </div>

      <div class="total-row grand-total">
        <span>Total</span>
        <strong>${escapeHtml(formatCurrency(invoice.totals.total))}</strong>
      </div>
    </section>

    <footer class="invoice-footer">
      <strong>Note:</strong> Keep refrigerated at 0–4°C. Consume fresh as instructed on the bottle. This invoice is system generated.
    </footer>
  </main>
</body>
</html>`;
}

router.get(
  "/orders/:orderRef",
  protect,
  async (req, res, next) => {
    try {
      const order =
        await findOrderForInvoice(
          req.params.orderRef
        );

      if (!order) {
        return res.status(404).json({
          success: false,
          message:
            "Order not found.",
        });
      }

      if (
        !canAccessInvoice(
          req.user,
          order
        )
      ) {
        return res.status(403).json({
          success: false,
          message:
            "You do not have permission to view this invoice.",
        });
      }

      return res.status(200).json({
        success: true,

        data: {
          invoice:
            normalizeInvoice(order),
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);

router.post(
  "/orders/:orderRef/print-link",
  protect,
  async (req, res, next) => {
    try {
      const order =
        await findOrderForInvoice(
          req.params.orderRef
        );

      if (!order) {
        return res.status(404).json({
          success: false,
          message:
            "Order not found.",
        });
      }

      if (
        !canAccessInvoice(
          req.user,
          order
        )
      ) {
        return res.status(403).json({
          success: false,
          message:
            "You do not have permission to print this invoice.",
        });
      }

      const token =
        createPrintToken({
          orderRef:
            order.orderNumber ||
            String(order._id),

          user:
            req.user,
        });

      return res.status(200).json({
        success: true,

        data: {
          printUrl:
            `/api/invoices/print/${token}`,

          expiresIn:
            PRINT_TOKEN_EXPIRES_IN,
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);

router.get(
  "/print/:token",
  async (req, res, next) => {
    try {
      const secret =
        process.env.JWT_SECRET;

      if (!secret) {
        return res.status(500).send(
          "Invoice print is not configured."
        );
      }

      const decoded =
        jwt.verify(
          req.params.token,
          secret
        );

      if (
        decoded.type !==
        "invoice_print"
      ) {
        return res.status(403).send(
          "Invalid invoice link."
        );
      }

      const order =
        await findOrderForInvoice(
          decoded.orderRef
        );

      if (!order) {
        return res.status(404).send(
          "Order not found."
        );
      }

      if (decoded.role !== "admin") {
        const orderUserId =
          String(
            order.user?._id ||
              order.user ||
              ""
          );

        if (
          String(decoded.userId) !==
          orderUserId
        ) {
          return res.status(403).send(
            "Invoice link is not valid for this order."
          );
        }
      }

      const invoice =
        normalizeInvoice(order);

      res.setHeader(
        "Content-Type",
        "text/html; charset=utf-8"
      );

      return res.status(200).send(
        buildInvoiceHtml(invoice)
      );
    } catch (error) {
      if (
        error.name ===
        "TokenExpiredError"
      ) {
        return res.status(401).send(
          "Invoice link expired. Please generate a new invoice link."
        );
      }

      return next(error);
    }
  }
);

module.exports = router;