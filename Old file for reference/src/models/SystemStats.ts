import mongoose, { Document, Schema } from "mongoose";

export interface ISystemStats extends Document {
  date: Date;
  totalUsers: number;
  activeUsers: number;
  totalSessions: number;
  activeSessions: number;
  textSessions: number;
  videoSessions: number;
  avgSessionDuration: number;
  peakConcurrentUsers: number;
  newRegistrations: number;
  totalMessages: number;
}

const SystemStatsSchema: Schema<ISystemStats> = new Schema(
  {
    date: {
      type: Date,
      required: true,
      unique: true,
    },
    totalUsers: {
      type: Number,
      default: 0,
    },
    activeUsers: {
      type: Number,
      default: 0,
    },
    totalSessions: {
      type: Number,
      default: 0,
    },
    activeSessions: {
      type: Number,
      default: 0,
    },
    textSessions: {
      type: Number,
      default: 0,
    },
    videoSessions: {
      type: Number,
      default: 0,
    },
    avgSessionDuration: {
      type: Number,
      default: 0,
    },
    peakConcurrentUsers: {
      type: Number,
      default: 0,
    },
    newRegistrations: {
      type: Number,
      default: 0,
    },
    totalMessages: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Index for performance
SystemStatsSchema.index({ date: -1 });

const SystemStats =
  mongoose.models.SystemStats ||
  mongoose.model<ISystemStats>("SystemStats", SystemStatsSchema);

export default SystemStats;
