"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { usePathname } from "next/navigation";

export function Header() {
  const pathname = usePathname();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 md:px-8 bg-black/80 backdrop-blur-md">
      <Link href="/" className="h-8 rounded-full flex items-center gap-2">
        <img
          src="/logo-circle.png"
          alt="SnapPair"
          className="h-full rounded-full"
        />
        <img src="/Snappair.svg" alt="SnapPairsvg" className=" h-[150%]" />
      </Link>

      <nav className="hidden md:flex items-center space-x-6">
        <Link
          href="/"
          className={`flex items-center gap-2 text-white hover:text-gray-300 transition-colors ${
            pathname === "/" ? "border-b-2 border-blue-500 pb-1" : ""
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
          Video Chat
        </Link>
        <Link
          href="/text-chat"
          className={`flex items-center gap-2 text-white hover:text-gray-300 transition-colors ${
            pathname === "/text-chat" ? "border-b-2 border-blue-500 pb-1" : ""
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          Text Chat
        </Link>
        <Link
          href="/voice-chat"
          className={`flex items-center gap-2 text-white hover:text-gray-300 transition-colors ${
            pathname === "/voice-chat" ? "border-b-2 border-blue-500 pb-1" : ""
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
            />
          </svg>
          Voice Chat
        </Link>
      </nav>

      <div className="flex items-center space-x-3">
        <Link href="/profile">
          <Button
            variant="outline"
            className="rounded-full border-white/20 hover:bg-white/10"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
            Profile
          </Button>
        </Link>
      </div>
    </header>
  );
}
