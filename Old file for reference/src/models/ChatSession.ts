import mongoose, { Document, Schema } from "mongoose";

export interface IChatSession extends Document {
  sessionId: string;
  user1Id: string;
  user2Id: string;
  user1Email?: string;
  user2Email?: string;
  sessionType: "text" | "video";
  startTime: Date;
  endTime?: Date;
  duration?: number; // in seconds
  status: "active" | "ended" | "disconnected";
  interests: string[];
  messagesCount?: number;
  endReason?: "next" | "stop" | "disconnect" | "error";
}

const ChatSessionSchema: Schema<IChatSession> = new Schema(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    user1Id: {
      type: String,
      required: true,
    },
    user2Id: {
      type: String,
      required: true,
    },
    user1Email: {
      type: String,
    },
    user2Email: {
      type: String,
    },
    sessionType: {
      type: String,
      enum: ["text", "video"],
      required: true,
    },
    startTime: {
      type: Date,
      default: Date.now,
    },
    endTime: {
      type: Date,
    },
    duration: {
      type: Number,
    },
    status: {
      type: String,
      enum: ["active", "ended", "disconnected"],
      default: "active",
    },
    interests: [
      {
        type: String,
      },
    ],
    messagesCount: {
      type: Number,
      default: 0,
    },
    endReason: {
      type: String,
      enum: ["next", "stop", "disconnect", "error"],
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance (sessionId index defined in schema above)
ChatSessionSchema.index({ status: 1 });
ChatSessionSchema.index({ sessionType: 1 });
ChatSessionSchema.index({ startTime: -1 });
ChatSessionSchema.index({ user1Id: 1, user2Id: 1 });

const ChatSession =
  mongoose.models.ChatSession ||
  mongoose.model<IChatSession>("ChatSession", ChatSessionSchema);

export default ChatSession;
