"use client";

import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";

// Dynamic import to avoid hydration issues
const DynamicTextChat = dynamic(
  () => import("@/components/SimplePeerTextChat"),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading Text Chat...</div>
      </div>
    ),
  }
);

export default function TextChat() {
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
        <div className="text-lg">Please sign in to access text chat</div>
      </div>
    );
  }

  return <DynamicTextChat session={session} />;
}
