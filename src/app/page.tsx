"use client";

import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Home() {
  const [interests, setInterests] = useState("");
  const { data: session, status } = useSession();
  const router = useRouter();

  const handleStartChat = (chatType: "text" | "video" | "voice") => {
    if (session) {
      router.push(`/${chatType}-chat`);
    } else {
      router.push("/auth/signin");
    }
  };

  return (
    <div className="h-screen bg-white flex flex-col overflow-hidden">
      {/* Auth Header */}
      <div className="bg-white shadow-sm border-b px-4 py-2 flex justify-between items-center flex-shrink-0">
        <h1 className="text-xl font-bold text-blue-600">Omegle</h1>
        <div className="flex items-center space-x-4">
          {status === "loading" ? (
            <div className="text-sm text-gray-500">Loading...</div>
          ) : session ? (
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">
                Welcome, {session.user?.name}!
              </span>
              <button
                onClick={() => signOut()}
                className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div className="space-x-2">
              <Link
                href="/auth/signin"
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
              >
                Sign In
              </Link>
              <Link
                href="/auth/signup"
                className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm"
              >
                Sign Up
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Header */}
      <div className="bg-gray-100 p-2 text-center text-xs text-gray-600 flex-shrink-0">
        You don&apos;t need an app to use Omegle on your phone or tablet! The
        web site works great on mobile.
      </div>

      {/* Flag Section */}
      <div className="flex justify-center py-2 flex-shrink-0">
        <div className="w-24 h-16 relative overflow-hidden rounded shadow-lg border">
          {/* American Flag */}
          <div className="h-full w-full relative">
            {/* Blue canton with stars */}
            <div className="absolute top-0 left-0 w-2/5 h-7/13 bg-blue-800 z-10">
              <div className="grid grid-cols-6 gap-0 h-full w-full p-0.5">
                {[...Array(50)].map((_, i) => (
                  <div key={i} className="flex items-center justify-center">
                    <span className="text-white text-[4px] leading-none">
                      ★
                    </span>
                  </div>
                ))}
              </div>
            </div>
            {/* Red and white stripes */}
            {[...Array(13)].map((_, i) => (
              <div
                key={i}
                className={`absolute w-full h-[7.69%] ${
                  i % 2 === 0 ? "bg-red-600" : "bg-white"
                }`}
                style={{ top: `${i * 7.69}%` }}
              ></div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 max-w-4xl mx-auto px-4 py-2 overflow-y-auto">
        <div className="space-y-4">
          {/* Main Content Section */}
          <div className="space-y-3">
            {/* About Omegle */}
            <div className="text-center space-y-2">
              <p className="text-sm leading-relaxed text-black">
                Omegle <span className="italic">(oh-meg-ull)</span> is a great
                way to meet new friends, even while practicing social
                distancing. When you use Omegle, we pick someone else at random
                and let you talk one-on-one. To help you stay safe, chats are
                anonymous unless you tell someone who you are{" "}
                <span className="text-red-600">(not suggested!)</span>, and you
                can stop a chat at any time. Predators have been known to use
                Omegle, so please be careful.
              </p>

              <p className="text-sm leading-relaxed text-black">
                If you prefer, you can add your interests, and Omegle will look
                for someone who&apos;s into some of the same things as you
                instead of someone completely random.
              </p>

              <p className="text-xs text-black font-semibold">
                By using Omegle, you accept the terms at the bottom. You must be
                18+ or 13+ with parental permission.
              </p>
            </div>

            {/* Video Monitoring Notice */}
            <div className="bg-blue-100 border-l-4 border-blue-500 p-3 rounded-r-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-blue-700 font-semibold text-sm">
                    Video is monitored. Keep it clean
                  </span>
                  <span className="text-orange-500 text-lg">⚠️</span>
                </div>
                <button className="text-blue-700 hover:text-blue-900 text-lg font-bold">
                  ×
                </button>
              </div>
              <div className="mt-2 space-x-4">
                <span className="text-xs text-black">18+:</span>
                <a
                  href="#"
                  className="text-blue-600 underline text-xs hover:text-blue-800"
                >
                  ( Adult )
                </a>
                <a
                  href="#"
                  className="text-blue-600 underline text-xs hover:text-blue-800"
                >
                  ( Unmoderated Section )
                </a>
              </div>
            </div>
          </div>

          {/* Chat Interface Section */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Interests Section */}
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-black">
                What do you wanna talk about?
              </h2>
              <input
                type="text"
                placeholder="Add your interests (optional)"
                value={interests}
                onChange={(e) => setInterests(e.target.value)}
                className="w-full p-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
              />

              {/* Preset Options */}
              <button className="w-full bg-gray-200 hover:bg-gray-300 text-black p-2 rounded-lg text-left transition-colors text-sm">
                ▶ College student chat
              </button>
            </div>

            {/* Start Chatting */}
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-black">
                Start chatting:
              </h2>
              <div className="flex flex-col space-y-2">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleStartChat("text")}
                    className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-3 rounded-lg transition-colors text-sm chat-button"
                  >
                    💬 Text
                  </button>
                  <button
                    onClick={() => handleStartChat("voice")}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-3 rounded-lg transition-colors text-sm chat-button"
                  >
                    🎤 Voice
                  </button>
                  <button
                    onClick={() => handleStartChat("video")}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-3 rounded-lg transition-colors text-sm chat-button"
                  >
                    📹 Video
                  </button>
                </div>
              </div>

              {!session && (
                <div className="text-center text-sm text-gray-600 mt-2">
                  <span>Sign in to start chatting</span>
                </div>
              )}

              {/* Additional Options */}
              <div className="flex justify-between text-xs text-gray-600 mt-2">
                <div>Spy (question) mode</div>
                <div>Unmoderated section</div>
              </div>
            </div>
          </div>

          {/* Footer Info */}
          <div className="text-center text-xs text-black pt-4 mt-4 border-t border-gray-200">
            <p>
              By using Omegle, you accept the terms of service and privacy
              policy.
            </p>
            <p className="mt-1">
              Please be respectful and follow community guidelines.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
