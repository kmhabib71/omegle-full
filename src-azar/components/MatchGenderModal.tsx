"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";

interface MatchGenderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (matchGender: string) => void;
  currentMatchGender: string;
}

export function MatchGenderModal({
  isOpen,
  onClose,
  onSave,
  currentMatchGender,
}: MatchGenderModalProps) {
  const [matchGender, setMatchGender] = useState(currentMatchGender || "all");

  useEffect(() => {
    setMatchGender(currentMatchGender || "all");
  }, [currentMatchGender, isOpen]);

  const handleGenderSelect = useCallback(
    (gender: string) => {
      setMatchGender(gender);
      setTimeout(() => {
        onSave(gender);
      }, 0);
    },
    [onSave]
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 rounded-xl w-full max-w-md p-6 mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-white">
            Match Gender Preference
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <p className="text-zinc-400 mb-6">
          Choose who you want to be matched with.
        </p>

        {/* Match Gender Selection */}
        <div className="mb-6">
          <h3 className="text-white font-medium mb-3">I Want to Match With</h3>
          <div className="space-y-3">
            <div
              className={`p-4 rounded-lg border-2 flex items-center gap-3 cursor-pointer ${
                matchGender === "all"
                  ? "bg-blue-600/20 border-blue-600"
                  : "border-zinc-700 bg-zinc-800/50"
              }`}
              onClick={() => handleGenderSelect("all")}
            >
              <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6v12m-8-6h16"
                  />
                </svg>
              </div>
              <div>
                <h3 className="font-medium text-white">Everyone</h3>
                <p className="text-sm text-gray-400">Match with anyone</p>
              </div>
            </div>

            <div
              className={`p-4 rounded-lg border-2 flex items-center gap-3 cursor-pointer ${
                matchGender === "male"
                  ? "bg-blue-600/20 border-blue-600"
                  : "border-zinc-700 bg-zinc-800/50"
              }`}
              onClick={() => handleGenderSelect("male")}
            >
              <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="font-medium text-white">Men</h3>
                <p className="text-sm text-gray-400">Match with men only</p>
              </div>
            </div>

            <div
              className={`p-4 rounded-lg border-2 flex items-center gap-3 cursor-pointer ${
                matchGender === "female"
                  ? "bg-blue-600/20 border-blue-600"
                  : "border-zinc-700 bg-zinc-800/50"
              }`}
              onClick={() => handleGenderSelect("female")}
            >
              <div className="w-10 h-10 rounded-full bg-pink-500 flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="font-medium text-white">Women</h3>
                <p className="text-sm text-gray-400">Match with women only</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-center mt-6">
          <Button
            onClick={onClose}
            variant="outline"
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-700 py-3 px-8"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
