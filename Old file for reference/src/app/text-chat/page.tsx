"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";

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
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-lg">Loading Text Chat...</div>
        </div>
      }
    >
      <DynamicTextChat />
    </Suspense>
  );
}
