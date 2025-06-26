"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

interface GenderFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (gender: string) => void;
  currentGender: string;
}

export function GenderFilterModal({
  isOpen,
  onClose,
  onSelect,
  currentGender,
}: GenderFilterModalProps) {
  const [selectedGender, setSelectedGender] = useState(currentGender);

  useEffect(() => {
    // Update selected gender when currentGender changes
    setSelectedGender(currentGender);
  }, [currentGender]);

  const handleApply = () => {
    onSelect(selectedGender);
    onClose();

    // Save to localStorage
    localStorage.setItem("snappairGenderFilter", selectedGender);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-zinc-900 rounded-xl w-full max-w-md p-6 mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-white">Select Gender</h2>
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

        <div className="space-y-3 my-4">
          <div
            className={`p-4 rounded-lg border-2 flex items-center gap-3 cursor-pointer ${
              selectedGender === "all"
                ? "bg-blue-600/20 border-blue-600"
                : "border-zinc-700 bg-zinc-800/50"
            }`}
            onClick={() => setSelectedGender("all")}
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
              <h3 className="font-medium text-white">All</h3>
              <p className="text-sm text-gray-400">Match with anyone</p>
            </div>
          </div>

          <div
            className={`p-4 rounded-lg border-2 flex items-center gap-3 cursor-pointer ${
              selectedGender === "male"
                ? "bg-blue-600/20 border-blue-600"
                : "border-zinc-700 bg-zinc-800/50"
            }`}
            onClick={() => setSelectedGender("male")}
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
              selectedGender === "female"
                ? "bg-blue-600/20 border-blue-600"
                : "border-zinc-700 bg-zinc-800/50"
            }`}
            onClick={() => setSelectedGender("female")}
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

        <div className="flex justify-end gap-3 mt-6">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-zinc-700 text-zinc-300"
          >
            Cancel
          </Button>
          <Button
            onClick={handleApply}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            Apply
          </Button>
        </div>
      </div>
    </div>
  );
}
