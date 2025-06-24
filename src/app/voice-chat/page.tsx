"use client";

import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";

// Dynamic import to avoid hydration issues
const DynamicVoiceChat = dynamic(
  () =>
    import("@/components/SimplePeerVoiceChat").then((mod) => ({
      default: mod.default,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading Voice Chat...</div>
      </div>
    ),
  }
);

export default function VoiceChat() {
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
        <div className="text-lg">Please sign in to access voice chat</div>
      </div>
    );
  }

  return <DynamicVoiceChat session={session} />;
}
