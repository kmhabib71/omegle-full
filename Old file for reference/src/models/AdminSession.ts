import mongoose, { Document, Schema } from "mongoose";

export interface IAdminSession extends Document {
  sessionId: string;
  isActive: boolean;
  loginTime: Date;
  lastActivity: Date;
  ipAddress?: string;
  userAgent?: string;
}

const AdminSessionSchema: Schema<IAdminSession> = new Schema(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    loginTime: {
      type: Date,
      default: Date.now,
    },
    lastActivity: {
      type: Date,
      default: Date.now,
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Index for performance
AdminSessionSchema.index({ sessionId: 1 });
AdminSessionSchema.index({ isActive: 1 });

const AdminSession =
  mongoose.models.AdminSession ||
  mongoose.model<IAdminSession>("AdminSession", AdminSessionSchema);

export default AdminSession;
