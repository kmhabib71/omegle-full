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

// Only protect admin routes - remove chat routes from protection
export const config = {
  matcher: ["/admin/:path*"],
};
