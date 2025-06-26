import { NextApiResponse } from "next";
import { Server as SocketIOServer } from "socket.io";
import { Server as NetServer } from "http";

export interface NextApiResponseServerIO extends NextApiResponse {
  socket: {
    server: NetServer & {
      io: SocketIOServer;
    };
  };
}
