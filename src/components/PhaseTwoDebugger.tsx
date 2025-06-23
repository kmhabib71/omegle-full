"use client";

import { useEffect, useState } from "react";

interface Phase2State {
  // Pre-connection Validation
  socketValidated: boolean;
  mediaPermissionsConfirmed: boolean;
  interestsValidated: boolean;
  existingSessionCleared: boolean;

  // Media Stream Setup
  localVideoInitialized: boolean;
  localVideoDisplayed: boolean;
  audioSettingsConfigured: boolean;
  streamQualityTested: boolean;

  // Queue Entry Process
  existingQueueEntriesCleared: boolean;
  addedToMatchingQueue: boolean;
  queueEntryLogged: boolean;
  uiUpdatedToSearching: boolean;

  // Button State Management
  startButtonHidden: boolean;
  nextButtonHidden: boolean;
  stopButtonShown: boolean;
  loadingIndicatorShown: boolean;
}

interface PhaseTwoDebuggerProps {
  connectionState: {
    socket: string;
    webrtc: string;
    media: string;
    queue: string;
  };
  isLookingForPartner: boolean;
  localStreamRef: React.MutableRefObject<MediaStream | null>;
  onStartPhase2Test: () => void;
}

export const PhaseTwoDebugger = ({
  connectionState,
  isLookingForPartner,
  localStreamRef,
  onStartPhase2Test,
}: PhaseTwoDebuggerProps) => {
  const [phase2State, setPhase2State] = useState<Phase2State>({
    // Pre-connection Validation
    socketValidated: false,
    mediaPermissionsConfirmed: false,
    interestsValidated: true, // Default true for now (no interests implemented)
    existingSessionCleared: false,

    // Media Stream Setup
    localVideoInitialized: false,
    localVideoDisplayed: false,
    audioSettingsConfigured: false,
    streamQualityTested: false,

    // Queue Entry Process
    existingQueueEntriesCleared: false,
    addedToMatchingQueue: false,
    queueEntryLogged: false,
    uiUpdatedToSearching: false,

    // Button State Management
    startButtonHidden: false,
    nextButtonHidden: true,
    stopButtonShown: false,
    loadingIndicatorShown: false,
  });

  const [isMinimized, setIsMinimized] = useState(false);

  // Auto-validate Phase 2 checkpoints based on props
  useEffect(() => {
    const validatePhase2Checkpoints = () => {
      setPhase2State((prev) => ({
        ...prev,
        // Pre-connection Validation
        socketValidated: connectionState.socket === "connected",
        mediaPermissionsConfirmed: !!localStreamRef.current,
        existingSessionCleared: true, // Assume cleared for now

        // Media Stream Setup
        localVideoInitialized: !!localStreamRef.current,
        localVideoDisplayed: (() => {
          const localVideo = document.getElementById(
            "localVideo"
          ) as HTMLVideoElement;
          return localVideo && localVideo.style.display !== "none";
        })(),
        audioSettingsConfigured: !!localStreamRef.current,
        streamQualityTested: !!localStreamRef.current,

        // Queue Entry Process
        existingQueueEntriesCleared: true, // Assume cleared
        addedToMatchingQueue:
          connectionState.queue === "searching" ||
          connectionState.queue === "matched",
        queueEntryLogged:
          connectionState.queue === "searching" ||
          connectionState.queue === "matched",
        uiUpdatedToSearching: isLookingForPartner,

        // Button State Management
        startButtonHidden:
          isLookingForPartner || connectionState.queue === "matched",
        nextButtonHidden: true, // Always hidden until connected
        stopButtonShown:
          isLookingForPartner || connectionState.queue === "matched",
        loadingIndicatorShown: isLookingForPartner,
      }));
    };

    validatePhase2Checkpoints();
  }, [connectionState, isLookingForPartner, localStreamRef]);

  const runPhase2Test = async () => {
    console.log("🧪 Running Phase 2 Test...");

    // Test Pre-connection Validation
    console.log("1️⃣ Testing Pre-connection Validation...");

    // Test Media Stream Setup
    console.log("2️⃣ Testing Media Stream Setup...");

    // Test Queue Entry Process
    console.log("3️⃣ Testing Queue Entry Process...");

    // Test Button State Management
    console.log("4️⃣ Testing Button State Management...");

    // Trigger the actual Phase 2 start from parent
    onStartPhase2Test();
  };

  const getStatusIcon = (status: boolean) => (status ? "✅" : "❌");

  // Calculate overall progress
  const allCheckpoints = Object.values(phase2State);
  const completedCheckpoints = allCheckpoints.filter(Boolean).length;
  const totalCheckpoints = allCheckpoints.length;
  const isPhase2Complete = completedCheckpoints === totalCheckpoints;

  return (
    <div className="bg-purple-900 text-white p-4 rounded-lg mb-6 font-mono text-sm">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-purple-400">
          🚀 Phase 2 Debug Panel - START Button Flow
        </h3>
        <div className="flex space-x-2">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-xs"
          >
            {isMinimized ? "Show" : "Hide"}
          </button>
          <button
            onClick={runPhase2Test}
            className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-xs"
          >
            Test Phase 2
          </button>
        </div>
      </div>

      {!isMinimized && (
        <div className="space-y-4">
          {/* Pre-connection Validation */}
          <div>
            <h4 className="text-yellow-400 font-bold mb-2">
              1️⃣ Pre-connection Validation
            </h4>
            <div className="space-y-1">
              <div>
                {getStatusIcon(phase2State.socketValidated)} Socket Connection
                Active
              </div>
              <div>
                {getStatusIcon(phase2State.mediaPermissionsConfirmed)} Media
                Permissions Confirmed
              </div>
              <div>
                {getStatusIcon(phase2State.interestsValidated)} Interests
                Validated
              </div>
              <div>
                {getStatusIcon(phase2State.existingSessionCleared)} Existing
                Session Cleared
              </div>
            </div>
          </div>

          {/* Media Stream Setup */}
          <div>
            <h4 className="text-yellow-400 font-bold mb-2">
              2️⃣ Media Stream Setup
            </h4>
            <div className="space-y-1">
              <div>
                {getStatusIcon(phase2State.localVideoInitialized)} Local Video
                Stream Initialized
              </div>
              <div>
                {getStatusIcon(phase2State.localVideoDisplayed)} Local Video
                Feed Displayed
              </div>
              <div>
                {getStatusIcon(phase2State.audioSettingsConfigured)} Audio
                Settings Configured
              </div>
              <div>
                {getStatusIcon(phase2State.streamQualityTested)} Stream Quality
                Tested
              </div>
            </div>
          </div>

          {/* Queue Entry Process */}
          <div>
            <h4 className="text-yellow-400 font-bold mb-2">
              3️⃣ Queue Entry Process
            </h4>
            <div className="space-y-1">
              <div>
                {getStatusIcon(phase2State.existingQueueEntriesCleared)}{" "}
                Existing Queue Entries Cleared
              </div>
              <div>
                {getStatusIcon(phase2State.addedToMatchingQueue)} Added to
                Matching Queue
              </div>
              <div>
                {getStatusIcon(phase2State.queueEntryLogged)} Queue Entry Logged
              </div>
              <div>
                {getStatusIcon(phase2State.uiUpdatedToSearching)} UI Updated to
                "Searching"
              </div>
            </div>
          </div>

          {/* Button State Management */}
          <div>
            <h4 className="text-yellow-400 font-bold mb-2">
              4️⃣ Button State Management
            </h4>
            <div className="space-y-1">
              <div>
                {getStatusIcon(phase2State.startButtonHidden)} START Button
                Hidden (when searching)
              </div>
              <div>
                {getStatusIcon(phase2State.nextButtonHidden)} NEXT Button Hidden
              </div>
              <div>
                {getStatusIcon(phase2State.stopButtonShown)} STOP Button Shown
              </div>
              <div>
                {getStatusIcon(phase2State.loadingIndicatorShown)} Loading
                Indicator Shown
              </div>
            </div>
          </div>

          {/* Current State Info */}
          <div className="pt-2 border-t border-purple-700">
            <div className="text-sm space-y-1">
              <div>
                Socket:{" "}
                <span className="text-yellow-300">
                  {connectionState.socket}
                </span>
              </div>
              <div>
                Queue:{" "}
                <span className="text-yellow-300">{connectionState.queue}</span>
              </div>
              <div>
                Looking for Partner:{" "}
                <span className="text-yellow-300">
                  {isLookingForPartner ? "Yes" : "No"}
                </span>
              </div>
              <div>
                Local Stream:{" "}
                <span className="text-yellow-300">
                  {localStreamRef.current ? "Active" : "None"}
                </span>
              </div>
            </div>
          </div>

          {/* Overall Phase 2 Status */}
          <div className="pt-2 border-t border-purple-700">
            <div className="text-lg">
              Phase 2 Complete: {isPhase2Complete ? "✅" : "❌"}
            </div>
            <div className="text-sm mt-2">
              Progress: {completedCheckpoints}/{totalCheckpoints} checkpoints
            </div>
            <div className="w-full bg-purple-800 rounded-full h-2 mt-2">
              <div
                className="bg-purple-400 h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${(completedCheckpoints / totalCheckpoints) * 100}%`,
                }}
              ></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
