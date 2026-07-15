// backend/src/services/adminActivityLogger.js

const AdminActivityLog = require("../models/AdminActivityLog");

function cleanText(value) {
  return String(value ?? "").trim();
}

function buildUserSnapshot(user) {
  if (!user) {
    return {
      fullName: "",
      email: "",
      phone: "",
      role: "",
    };
  }

  return {
    fullName:
      cleanText(user.fullName) ||
      cleanText(user.name),

    email:
      cleanText(user.email).toLowerCase(),

    phone:
      cleanText(user.phone),

    role:
      cleanText(user.role),
  };
}

function buildActorSnapshot(user) {
  const snapshot =
    buildUserSnapshot(user);

  return {
    fullName:
      snapshot.fullName ||
      "Admin",

    email:
      snapshot.email,

    role:
      snapshot.role ||
      "admin",
  };
}

function buildRequestSnapshot(req) {
  if (!req) {
    return {
      ip: "",
      userAgent: "",
      method: "",
      path: "",
    };
  }

  return {
    ip:
      cleanText(
        req.headers?.["x-forwarded-for"]
      )
        .split(",")[0]
        .trim() ||
      cleanText(req.ip),

    userAgent:
      cleanText(
        req.headers?.["user-agent"]
      ),

    method:
      cleanText(req.method),

    path:
      cleanText(
        req.originalUrl ||
          req.url ||
          req.path
      ),
  };
}

async function logAdminActivity({
  req,
  actor,
  actionType,
  actionLabel,
  severity = "info",
  message = "",
  entityType = "",
  entityId = null,
  entityLabel = "",
  targetUser = null,
  targetUserSnapshot = null,
  metadata = {},
}) {
  try {
    const resolvedActor =
      actor || req?.user || null;

    await AdminActivityLog.create({
      actionType:
        cleanText(actionType),

      actionLabel:
        cleanText(actionLabel),

      severity:
        cleanText(severity) ||
        "info",

      message:
        cleanText(message),

      actor:
        resolvedActor?._id ||
        resolvedActor?.id ||
        null,

      actorSnapshot:
        buildActorSnapshot(
          resolvedActor
        ),

      entityType:
        cleanText(entityType),

      entityId:
        entityId || null,

      entityLabel:
        cleanText(entityLabel),

      targetUser:
        targetUser?._id ||
        targetUser?.id ||
        null,

      targetUserSnapshot:
        targetUserSnapshot ||
        buildUserSnapshot(targetUser),

      requestSnapshot:
        buildRequestSnapshot(req),

      metadata:
        metadata || {},

      active: true,
    });
  } catch (error) {
    console.error(
      "Admin activity logging failed:",
      error
    );
  }
}

module.exports = {
  logAdminActivity,
  buildActorSnapshot,
  buildUserSnapshot,
};