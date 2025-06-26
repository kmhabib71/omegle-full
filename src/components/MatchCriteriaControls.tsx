"use client";

interface MatchCriteria {
  gender: string | null;
  country: string | null;
  interests: string[];
}

interface MatchCriteriaControlsProps {
  isVisible: boolean;
  currentCriteria: MatchCriteria;
  onOpenModal: (modalType: "gender" | "country" | "game") => void;
  onStopSearch: () => void;
}

export function MatchCriteriaControls({
  isVisible,
  currentCriteria,
  onOpenModal,
  onStopSearch,
}: MatchCriteriaControlsProps) {
  // Helper functions to get display text
  const getGenderText = () => {
    switch (currentCriteria.gender) {
      case "male":
        return "Male";
      case "female":
        return "Female";
      default:
        return "Everyone";
    }
  };

  const getCountryText = () => {
    return currentCriteria.country || "Worldwide";
  };

  const getGamesText = () => {
    if (currentCriteria.interests.length === 0) {
      return "Any Games";
    }
    if (currentCriteria.interests.length === 1) {
      return currentCriteria.interests[0];
    }
    return `${currentCriteria.interests.length} Games`;
  };

  if (!isVisible) return null;

  return (
    <>
      {/* Match Criteria Display - Shown over the remote video area when searching */}
      <div className="flex flex-wrap justify-center gap-3 mb-4">
        {/* Gender Filter Button */}
        <button
          onClick={() => onOpenModal("gender")}
          className="rounded-full px-4 py-2 flex items-center justify-center gap-2 text-sm border border-zinc-700 bg-zinc-800/70 hover:bg-zinc-700/80 transition-colors"
        >
          <span className="inline-flex items-center justify-center w-5 h-5 bg-blue-500 rounded-full">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-3 w-3 text-white"
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
          </span>
          Match Gender: {getGenderText()}
        </button>

        {/* Country Filter Button */}
        <button
          onClick={() => onOpenModal("country")}
          className="rounded-full px-4 py-2 flex items-center justify-center gap-2 text-sm border border-zinc-700 bg-zinc-800/70 hover:bg-zinc-700/80 transition-colors"
        >
          <span className="inline-flex items-center justify-center w-5 h-5 bg-green-500 rounded-full">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-3 w-3 text-white"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                clipRule="evenodd"
              />
            </svg>
          </span>
          Match Country: {getCountryText()}
        </button>

        {/* Games Filter Button */}
        <button
          onClick={() => onOpenModal("game")}
          className="rounded-full px-4 py-2 flex items-center justify-center gap-2 text-sm border border-zinc-700 bg-zinc-800/70 hover:bg-zinc-700/80 transition-colors"
        >
          <span className="inline-flex items-center justify-center w-5 h-5 bg-purple-500 rounded-full">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-3 w-3 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16m-7 6h7"
              />
            </svg>
          </span>
          Games: {getGamesText()}
        </button>
      </div>
    </>
  );
}
