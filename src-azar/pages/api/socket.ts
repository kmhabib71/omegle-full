import { NextApiRequest } from "next";
import { NextApiResponseServerIO } from "@/types/next";
import { initSocketServer } from "@/server/socket";

export default function handler(
  req: NextApiRequest,
  res: NextApiResponseServerIO
) {
  // Initialize socket server
  initSocketServer(req, res);
}

export const config = {
  api: {
    bodyParser: false,
  },
};
