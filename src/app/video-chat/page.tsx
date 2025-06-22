"use client";

import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";

// Dynamic import to avoid hydration issues
const DynamicVideoChat = dynamic(() => import("@/components/VideoChat"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-lg">Loading Video Chat...</div>
    </div>
  ),
});

export default function VideoChat() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Please sign in to access video chat</div>
      </div>
    );
  }

  return <DynamicVideoChat session={session} />;
}
