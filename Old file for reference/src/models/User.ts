import mongoose, { Document, Schema } from "mongoose";
import bcrypt from "bcryptjs";

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  image?: string;
  provider: "email" | "google" | "credentials" | "anonymous";
  googleId?: string;
  emailVerified?: Date;
  isAnonymous?: boolean;
  anonymousId?: string;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const UserSchema: Schema<IUser> = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: {
      type: String,
      required: function (this: IUser) {
        return this.provider === "email" || this.provider === "credentials";
      },
      minlength: 6,
    },
    image: {
      type: String,
    },
    provider: {
      type: String,
      enum: ["email", "google", "credentials", "anonymous"],
      default: "email",
    },
    googleId: {
      type: String,
      sparse: true,
      index: true,
    },
    emailVerified: {
      type: Date,
    },
    isAnonymous: {
      type: Boolean,
      default: false,
    },
    anonymousId: {
      type: String,
      sparse: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes are defined in the schema fields above

// Hash password before saving
UserSchema.pre("save", async function (next) {
  if (!this.isModified("password") || !this.password) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Compare password method
UserSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  if (!this.password) {
    return false;
  }
  return bcrypt.compare(candidatePassword, this.password);
};

// Prevent re-compilation during development
const User = mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

export default User;
