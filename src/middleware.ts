import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware() {
    // Additional middleware logic can be added here
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

// Protect these routes
export const config = {
  matcher: [
    "/video-chat/:path*",
    "/text-chat/:path*",
    "/voice-chat/:path*",
    "/profile/:path*",
  ],
};
