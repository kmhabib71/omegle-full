import { PrismaClient } from "@prisma/client";

// Add prisma to the global type
declare global {
  var prisma: PrismaClient | undefined;
}

// Create a new PrismaClient if one doesn't exist or use the existing one
export const prisma = global.prisma || new PrismaClient();

// In development, we'll attach the client to the global object to prevent multiple instances
if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}
