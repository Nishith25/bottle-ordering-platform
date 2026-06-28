// backend/src/scripts/makeAdmin.js

require("dotenv").config();

const mongoose = require("mongoose");

const connectDB = require("../config/db");
const User = require("../models/User");

function readArgument(name) {
  const flag = `--${name}`;
  const index = process.argv.indexOf(flag);

  if (
    index === -1 ||
    !process.argv[index + 1]
  ) {
    return "";
  }

  return String(
    process.argv[index + 1]
  ).trim();
}

async function makeAdmin() {
  try {
    const identifier =
      readArgument("identifier")
        .toLowerCase();

    if (!identifier) {
      throw new Error(
        "Provide an existing customer email or phone using --identifier."
      );
    }

    await connectDB();

    const user = await User.findOne({
      $or: [
        {
          email: identifier,
        },
        {
          phone: identifier.replace(
            /\D/g,
            ""
          ),
        },
      ],
    });

    if (!user) {
      throw new Error(
        "User not found. Register this account in the customer app first."
      );
    }

    user.role = "admin";
    user.active = true;

    await user.save();

    console.log(
      "Admin access granted successfully."
    );

    console.log({
      id: user._id.toString(),
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      role: user.role,
    });
  } catch (error) {
    console.error(
      "Unable to create admin:",
      error.message
    );

    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
}

makeAdmin();