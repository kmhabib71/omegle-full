"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

interface OnboardingStep {
  title: string;
  description: string;
  image: string;
  position?:
    | "center"
    | "top-left"
    | "top-right"
    | "bottom-left"
    | "bottom-right";
  targetElement?: string;
}

export function Onboarding() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [highlightElement, setHighlightElement] = useState<HTMLElement | null>(
    null
  );

  // Onboarding steps configuration
  const steps: OnboardingStep[] = [
    {
      title: "Welcome to SnapPair!",
      description:
        "Connect with new people around the world through video chat. Let's explore the app together!",
      image:
        "https://images.unsplash.com/photo-1543269664-56d93c1b41a6?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxzZWFyY2h8Mnx8d29ybGQlMjBjb25uZWN0aW9ufGVufDB8fDB8fA%3D%3D&auto=format&fit=crop&w=500&q=60",
      position: "center",
    },
    {
      title: "Start a Video Chat",
      description:
        "Click the 'Start Video Chat' button to begin matching with people worldwide.",
      image:
        "https://images.unsplash.com/photo-1573164574572-cb89e39749b4?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxzZWFyY2h8Nnx8dmlkZW8lMjBjaGF0fGVufDB8fDB8fA%3D%3D&auto=format&fit=crop&w=500&q=60",
      position: "bottom-right",
      targetElement: "[data-onboarding='start-chat']",
    },
    {
      title: "Set Your Preferences",
      description:
        "Use the filters to set your preferences for gender and country to find your ideal match.",
      image:
        "https://images.unsplash.com/photo-1511632765486-a01980e01a18?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxzZWFyY2h8MTJ8fHByZWZlcmVuY2VzfGVufDB8fDB8fA%3D%3D&auto=format&fit=crop&w=500&q=60",
      position: "top-right",
      targetElement: "[data-onboarding='filters']",
    },
    {
      title: "Chat with Matches",
      description:
        "Once connected, you can use text chat to communicate in addition to video.",
      image:
        "https://images.unsplash.com/photo-1577563908411-5077b6dc7624?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxzZWFyY2h8M3x8Y2hhdHxlbnwwfHwwfHw%3D&auto=format&fit=crop&w=500&q=60",
      position: "bottom-left",
      targetElement: "[data-onboarding='text-chat']",
    },
    {
      title: "Try Camera Filters",
      description:
        "Enhance your video chat experience with fun camera filters and effects.",
      image:
        "https://images.unsplash.com/photo-1568605114967-8130f3a36994?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxzZWFyY2h8NXx8ZmlsdGVyfGVufDB8fDB8fA%3D%3D&auto=format&fit=crop&w=500&q=60",
      position: "top-left",
      targetElement: "[data-onboarding='camera-filters']",
    },
    {
      title: "View Your History",
      description:
        "Access your chat history to reconnect with people you've met before.",
      image:
        "https://images.unsplash.com/photo-1506784983877-45594efa4cbe?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxzZWFyY2h8Mnx8aGlzdG9yeXxlbnwwfHwwfHw%3D&auto=format&fit=crop&w=500&q=60",
      position: "top-right",
      targetElement: "[data-onboarding='history']",
    },
    {
      title: "Complete Your Profile",
      description:
        "Customize your profile and settings to make the most of your experience.",
      image:
        "https://images.unsplash.com/photo-1573497620053-ea5300f94f21?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxzZWFyY2h8MTB8fHByb2ZpbGV8ZW58MHx8MHx8&auto=format&fit=crop&w=500&q=60",
      position: "bottom-right",
      targetElement: "[data-onboarding='profile']",
    },
    {
      title: "You're All Set!",
      description:
        "Start connecting with people from around the world. Enjoy SnapPair!",
      image:
        "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxzZWFyY2h8MjN8fGZyaWVuZHN8ZW58MHx8MHx8&auto=format&fit=crop&w=500&q=60",
      position: "center",
    },
  ];

  // Check if this is the first visit to show onboarding
  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem(
      "snappair-onboarding-completed"
    );
    if (!hasSeenOnboarding) {
      // Wait a bit before showing the onboarding
      const timer = setTimeout(() => {
        setShowOnboarding(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  // Handle highlighting elements for each step
  useEffect(() => {
    const currentTargetSelector = steps[currentStep]?.targetElement;
    if (currentTargetSelector) {
      const element = document.querySelector(
        currentTargetSelector
      ) as HTMLElement;
      setHighlightElement(element);

      if (element) {
        // Scroll element into view if needed
        element.scrollIntoView({ behavior: "smooth", block: "center" });

        // Add highlight class
        element.classList.add("onboarding-highlight");
      }
    } else {
      setHighlightElement(null);
    }

    // Clean up previous highlight
    return () => {
      if (highlightElement) {
        highlightElement.classList.remove("onboarding-highlight");
      }
    };
  }, [currentStep, steps]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      completeOnboarding();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    completeOnboarding();
  };

  const completeOnboarding = () => {
    localStorage.setItem("snappair-onboarding-completed", "true");
    setShowOnboarding(false);

    // Clean up any remaining highlights
    if (highlightElement) {
      highlightElement.classList.remove("onboarding-highlight");
    }
  };

  if (!showOnboarding) return null;

  const currentStepData = steps[currentStep];

  // Calculate position classes
  let positionClasses =
    "fixed z-50 bg-zinc-900 rounded-xl overflow-hidden shadow-xl border border-zinc-700 max-w-md w-full";
  switch (currentStepData.position) {
    case "top-left":
      positionClasses += " top-24 left-4";
      break;
    case "top-right":
      positionClasses += " top-24 right-4";
      break;
    case "bottom-left":
      positionClasses += " bottom-24 left-4";
      break;
    case "bottom-right":
      positionClasses += " bottom-24 right-4";
      break;
    default: // center
      positionClasses +=
        " top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2";
      break;
  }

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/70 z-40"></div>

      {/* Tutorial Dialog */}
      <div className={positionClasses}>
        {/* Image */}
        <div className="h-40 overflow-hidden">
          <img
            src={currentStepData.image}
            alt={currentStepData.title}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Content */}
        <div className="p-6">
          <h3 className="text-xl font-bold text-white mb-2">
            {currentStepData.title}
          </h3>
          <p className="text-gray-300 mb-6">{currentStepData.description}</p>

          {/* Progress Indicators */}
          <div className="flex justify-center mb-4">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`h-1.5 rounded-full mx-1 transition-all ${
                  index === currentStep ? "w-6 bg-blue-500" : "w-3 bg-zinc-700"
                }`}
              ></div>
            ))}
          </div>

          {/* Navigation Buttons */}
          <div className="flex justify-between">
            {currentStep > 0 ? (
              <Button
                onClick={handlePrevious}
                className="bg-zinc-800 hover:bg-zinc-700 text-white"
              >
                Back
              </Button>
            ) : (
              <Button
                onClick={handleSkip}
                className="bg-zinc-800 hover:bg-zinc-700 text-white"
              >
                Skip Tour
              </Button>
            )}

            <Button
              onClick={handleNext}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {currentStep < steps.length - 1 ? "Next" : "Get Started"}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
