import mongoose, { Document, Schema } from "mongoose";
import bcrypt from "bcryptjs";

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  image?: string;
  provider: "email" | "google";
  googleId?: string;
  emailVerified?: Date;
  bio?: string;
  gender?: string;
  username?: string;
  profileImage?: string;
  // Match preferences
  matchGender?: string;
  matchCountry?: string;
  matchInterest?: string[]; // Game preferences
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
    },
    password: {
      type: String,
      required: function (this: IUser) {
        return this.provider === "email";
      },
      minlength: 6,
    },
    image: {
      type: String,
    },
    provider: {
      type: String,
      enum: ["email", "google"],
      default: "email",
    },
    googleId: {
      type: String,
      sparse: true,
    },
    emailVerified: {
      type: Date,
    },
    bio: {
      type: String,
      maxlength: 500,
    },
    gender: {
      type: String,
      enum: ["male", "female", "other"],
    },
    username: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    profileImage: {
      type: String,
    },
    // Match preferences
    matchGender: {
      type: String,
      enum: ["all", "male", "female"],
      default: "all",
    },
    matchCountry: {
      type: String,
    },
    matchInterest: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Index for performance
UserSchema.index({ email: 1 });
UserSchema.index({ googleId: 1 });
UserSchema.index({ username: 1 });

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
