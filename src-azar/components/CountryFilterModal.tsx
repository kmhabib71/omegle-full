"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

// List of countries for the filter
const countries = [
  { code: "us", name: "United States" },
  { code: "gb", name: "United Kingdom" },
  { code: "ca", name: "Canada" },
  { code: "au", name: "Australia" },
  { code: "fr", name: "France" },
  { code: "de", name: "Germany" },
  { code: "jp", name: "Japan" },
  { code: "kr", name: "South Korea" },
  { code: "cn", name: "China" },
  { code: "in", name: "India" },
  { code: "br", name: "Brazil" },
  { code: "ru", name: "Russia" },
  { code: "es", name: "Spain" },
  { code: "it", name: "Italy" },
  { code: "mx", name: "Mexico" },
  { code: "za", name: "South Africa" },
  { code: "nl", name: "Netherlands" },
  { code: "se", name: "Sweden" },
  { code: "sg", name: "Singapore" },
  { code: "tr", name: "Turkey" },
];

interface CountryFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (country: string | null) => void;
  currentCountry: string | null;
}

export function CountryFilterModal({
  isOpen,
  onClose,
  onSelect,
  currentCountry,
}: CountryFilterModalProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<string | null>(
    currentCountry
  );

  useEffect(() => {
    // Update selected country when currentCountry changes
    setSelectedCountry(currentCountry);
  }, [currentCountry]);

  const handleApply = () => {
    onSelect(selectedCountry);
    onClose();

    // Save to localStorage
    if (selectedCountry) {
      localStorage.setItem("snappairCountryFilter", selectedCountry);
    } else {
      localStorage.removeItem("snappairCountryFilter");
    }
  };

  const filteredCountries = countries.filter((country) =>
    country.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-zinc-900 rounded-xl w-full max-w-md p-6 mx-4 max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-white">Select Country</h2>
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

        <div className="mb-4">
          <input
            type="text"
            placeholder="Search countries..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:border-blue-500 text-white"
          />
        </div>

        <div
          className={`p-4 rounded-lg border-2 flex items-center gap-3 cursor-pointer mb-3 ${
            selectedCountry === null
              ? "bg-blue-600/20 border-blue-600"
              : "border-zinc-700 bg-zinc-800/50"
          }`}
          onClick={() => setSelectedCountry(null)}
        >
          <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
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
                d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064"
              />
            </svg>
          </div>
          <div>
            <h3 className="font-medium text-white">Any Country</h3>
            <p className="text-sm text-gray-400">
              Match with users from any country
            </p>
          </div>
        </div>

        <div className="overflow-y-auto flex-grow">
          <div className="space-y-2">
            {filteredCountries.map((country) => (
              <div
                key={country.code}
                className={`p-3 rounded-lg border flex items-center gap-3 cursor-pointer ${
                  selectedCountry === country.name
                    ? "bg-blue-600/20 border-blue-600"
                    : "border-zinc-700 bg-zinc-800/50"
                }`}
                onClick={() => setSelectedCountry(country.name)}
              >
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden">
                    <span className="text-lg">
                      {country.code
                        .toUpperCase()
                        .split("")
                        .map((c) =>
                          String.fromCodePoint(c.charCodeAt(0) + 127397)
                        )
                        .join("")}
                    </span>
                  </div>
                </div>
                <div className="text-white">{country.name}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-4 pt-3 border-t border-zinc-800">
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
