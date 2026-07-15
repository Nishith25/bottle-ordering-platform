const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

const savedAddressSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      trim: true,
      maxlength: [40, "Address label cannot exceed 40 characters."],
      default: "Home",
    },

    fullName: {
      type: String,
      required: [true, "Full name is required."],
      trim: true,
      minlength: [2, "Full name must contain at least 2 characters."],
      maxlength: [80, "Full name cannot exceed 80 characters."],
    },

    phone: {
      type: String,
      required: [true, "Mobile number is required."],
      trim: true,
      match: [
        /^[6-9]\d{9}$/,
        "Please provide a valid 10-digit Indian mobile number.",
      ],
    },

    pincode: {
      type: String,
      required: [true, "Pincode is required."],
      trim: true,
      match: [/^\d{6}$/, "Please provide a valid 6-digit pincode."],
    },

    houseDetails: {
      type: String,
      required: [true, "House, flat or building is required."],
      trim: true,
      minlength: [3, "House details must contain at least 3 characters."],
      maxlength: [160, "House details cannot exceed 160 characters."],
    },

    areaDetails: {
      type: String,
      required: [true, "Area and street are required."],
      trim: true,
      minlength: [3, "Area details must contain at least 3 characters."],
      maxlength: [220, "Area details cannot exceed 220 characters."],
    },

    landmark: {
      type: String,
      trim: true,
      maxlength: [120, "Landmark cannot exceed 120 characters."],
      default: "",
    },

    area: {
      type: String,
      required: [true, "Delivery area is required."],
      trim: true,
      maxlength: [80, "Area cannot exceed 80 characters."],
    },

    city: {
      type: String,
      required: [true, "Delivery city is required."],
      trim: true,
      maxlength: [80, "City cannot exceed 80 characters."],
    },

    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  {
    _id: true,
    timestamps: true,
  }
);

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, "Full name is required."],
      trim: true,
      minlength: [2, "Full name must contain at least 2 characters."],
      maxlength: [80, "Full name cannot exceed 80 characters."],
    },

    email: {
      type: String,
      required: [true, "Email address is required."],
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: [120, "Email address is too long."],
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Please provide a valid email address.",
      ],
    },

    phone: {
      type: String,
      required: [true, "Mobile number is required."],
      unique: true,
      trim: true,
      match: [
        /^[6-9]\d{9}$/,
        "Please provide a valid 10-digit Indian mobile number.",
      ],
    },

    password: {
      type: String,
      required: [true, "Password is required."],
      minlength: [8, "Password must contain at least 8 characters."],
      select: false,
    },

    role: {
      type: String,
      enum: ["customer", "admin", "delivery"],
      default: "customer",
    },

    active: {
      type: Boolean,
      default: true,
    },

    emailVerified: {
      type: Boolean,
      default: false,
    },

    phoneVerified: {
      type: Boolean,
      default: false,
    },

    savedAddresses: {
      type: [savedAddressSchema],
      default: [],
    },

    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.index({
  role: 1,
  active: 1,
});

userSchema.pre("save", async function hashPassword() {
  if (!this.isModified("password")) {
    return;
  }

  const saltRounds = 12;

  this.password = await bcrypt.hash(
    this.password,
    saltRounds
  );
});

userSchema.methods.comparePassword =
  async function comparePassword(candidatePassword) {
    return bcrypt.compare(
      candidatePassword,
      this.password
    );
  };

function formatSavedAddress(address) {
  return {
    id: address._id.toString(),
    label: address.label,
    fullName: address.fullName,
    phone: address.phone,
    pincode: address.pincode,
    houseDetails: address.houseDetails,
    areaDetails: address.areaDetails,
    landmark: address.landmark || "",
    area: address.area,
    city: address.city,
    isDefault: Boolean(address.isDefault),
    createdAt: address.createdAt,
    updatedAt: address.updatedAt,
  };
}

userSchema.methods.toPublicJSON =
  function toPublicJSON() {
    const savedAddresses = Array.isArray(
      this.savedAddresses
    )
      ? this.savedAddresses
          .map(formatSavedAddress)
          .sort((first, second) => {
            if (first.isDefault && !second.isDefault) {
              return -1;
            }

            if (!first.isDefault && second.isDefault) {
              return 1;
            }

            return new Date(second.updatedAt || second.createdAt || 0).getTime() -
              new Date(first.updatedAt || first.createdAt || 0).getTime();
          })
      : [];

    return {
      id: this._id.toString(),
      fullName: this.fullName,
      email: this.email,
      phone: this.phone,
      role: this.role,
      active: this.active,
      emailVerified: this.emailVerified,
      phoneVerified: this.phoneVerified,
      savedAddresses,
      lastLoginAt: this.lastLoginAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  };

module.exports = mongoose.model(
  "User",
  userSchema
);