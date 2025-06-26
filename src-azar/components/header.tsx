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
          className={`text-white hover:text-gray-300 transition-colors ${
            pathname === "/" ? "border-b-2 border-blue-500 pb-1" : ""
          }`}
        >
          Video Chat
        </Link>
        <Link
          href="/history"
          className={`text-white hover:text-gray-300 transition-colors ${
            pathname === "/history" ? "border-b-2 border-blue-500 pb-1" : ""
          }`}
          data-onboarding="history"
        >
          History
        </Link>
        <Link
          href="/about"
          className={`text-white hover:text-gray-300 transition-colors ${
            pathname === "/about" ? "border-b-2 border-blue-500 pb-1" : ""
          }`}
        >
          About
        </Link>
        <Link
          href="/blog"
          className={`text-white hover:text-gray-300 transition-colors ${
            pathname === "/blog" ? "border-b-2 border-blue-500 pb-1" : ""
          }`}
        >
          Blog
        </Link>
      </nav>

      <div className="flex items-center space-x-3">
        {/* <Link href="/shop">
          <Button variant="outline" className={`rounded-full bg-yellow-500/20 text-yellow-500 border-yellow-500/30 hover:bg-yellow-500/30 ${pathname === '/shop' ? 'bg-yellow-500/30' : ''}`}>
            <span className="mr-1">💎</span>
            Shop
          </Button>
        </Link> */}
        <Link href="/profile">
          <Button
            variant="outline"
            className={`rounded-full border-white/20 hover:bg-white/10 ${
              pathname === "/profile" ? "bg-white/10" : ""
            }`}
            data-onboarding="profile"
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
