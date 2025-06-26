"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";

// Dynamic import to avoid hydration issues
const DynamicVideoChat = dynamic(
  () => import("@/components/SimplePeerVideoChat"),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading Video Chat...</div>
      </div>
    ),
  }
);

export default function VideoChat() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-lg">Loading Video Chat...</div>
        </div>
      }
    >
      <DynamicVideoChat />
    </Suspense>
  );
}
