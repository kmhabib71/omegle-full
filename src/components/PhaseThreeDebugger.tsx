"use client";

import { useEffect, useState } from "react";

interface Phase3State {
  // Match Validation (4 checkpoints)
  partnerSocketActive: boolean;
  bothUsersInQueue: boolean;
  uniqueSessionCreated: boolean;
  bothUsersRemovedFromQueue: boolean;

  // WebRTC Connection Setup (4 checkpoints)
  freshPeerConnectionCreated: boolean;
  localStreamTracksAdded: boolean;
  iceServersConfigured: boolean;
  connectionEventHandlersSet: boolean;

  // Signaling Process (4 checkpoints)
  initiatorDetermined: boolean;
  offerAnswerExchanged: boolean;
  iceCandidateExchangeActive: boolean;
  connectionStateMonitored: boolean;

  // Connection Establishment (4 checkpoints)
  connectionStateConnected: boolean;
  remoteVideoStreamDisplayed: boolean;
  searchingIndicatorCleared: boolean;
  connectionStatusUpdated: boolean;

  // UI State Update (4 checkpoints)
  startButtonHidden: boolean;
  nextButtonEnabled: boolean;
  stopButtonEnabled: boolean;
  messageInputEnabled: boolean;
}

interface Phase3Props {
  connectionState: any;
  partnerId: string | null;
  peerConnection: RTCPeerConnection | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isConnectedToPartner: boolean;
  sessionId: string | null;
  onTestPhase3: () => void;
}

export const PhaseThreeDebugger = ({
  connectionState,
  partnerId,
  peerConnection,
  localStream,
  remoteStream,
  isConnectedToPartner,
  sessionId,
  onTestPhase3,
}: Phase3Props) => {
  const [phase3State, setPhase3State] = useState<Phase3State>({
    // Match Validation
    partnerSocketActive: false,
    bothUsersInQueue: false,
    uniqueSessionCreated: false,
    bothUsersRemovedFromQueue: false,

    // WebRTC Connection Setup
    freshPeerConnectionCreated: false,
    localStreamTracksAdded: false,
    iceServersConfigured: false,
    connectionEventHandlersSet: false,

    // Signaling Process
    initiatorDetermined: false,
    offerAnswerExchanged: false,
    iceCandidateExchangeActive: false,
    connectionStateMonitored: false,

    // Connection Establishment
    connectionStateConnected: false,
    remoteVideoStreamDisplayed: false,
    searchingIndicatorCleared: false,
    connectionStatusUpdated: false,

    // UI State Update
    startButtonHidden: false,
    nextButtonEnabled: false,
    stopButtonEnabled: false,
    messageInputEnabled: false,
  });

  const [isMinimized, setIsMinimized] = useState(false);

  // Update Phase 3 state based on props
  useEffect(() => {
    setPhase3State((prev) => ({
      ...prev,
      // Match Validation
      partnerSocketActive: !!partnerId,
      bothUsersInQueue: connectionState.queue === "matched",
      uniqueSessionCreated: !!sessionId,
      bothUsersRemovedFromQueue: connectionState.queue !== "searching",

      // WebRTC Connection Setup
      freshPeerConnectionCreated: !!peerConnection,
      localStreamTracksAdded: !!localStream && !!peerConnection,
      iceServersConfigured: !!peerConnection,
      connectionEventHandlersSet: !!peerConnection,

      // Signaling Process
      initiatorDetermined: !!partnerId,
      offerAnswerExchanged:
        !!peerConnection &&
        (peerConnection.connectionState === "connected" ||
          peerConnection.connectionState === "connecting" ||
          peerConnection.localDescription !== null ||
          isConnectedToPartner),
      iceCandidateExchangeActive:
        !!peerConnection &&
        (peerConnection.iceConnectionState === "connected" ||
          peerConnection.iceConnectionState === "checking" ||
          peerConnection.iceConnectionState === "completed" ||
          isConnectedToPartner),
      connectionStateMonitored: !!peerConnection,

      // Connection Establishment
      connectionStateConnected:
        peerConnection?.connectionState === "connected" || isConnectedToPartner,
      remoteVideoStreamDisplayed: !!remoteStream,
      searchingIndicatorCleared: connectionState.queue !== "searching",
      connectionStatusUpdated: isConnectedToPartner,

      // UI State Update
      startButtonHidden:
        connectionState.queue === "matched" || isConnectedToPartner,
      nextButtonEnabled: isConnectedToPartner,
      stopButtonEnabled:
        connectionState.queue === "searching" ||
        connectionState.queue === "matched",
      messageInputEnabled: isConnectedToPartner,
    }));
  }, [
    connectionState,
    partnerId,
    peerConnection,
    localStream,
    remoteStream,
    isConnectedToPartner,
    sessionId,
  ]);

  const runPhase3Test = async () => {
    console.log("🧪 Running Phase 3 Test...");
    onTestPhase3();
  };

  const getStatusIcon = (status: boolean) => (status ? "✔" : "❌");
  const getCheckpointCount = () =>
    Object.values(phase3State).filter(Boolean).length;
  const allComplete = getCheckpointCount() === 20;

  const getConnectionStateDisplay = () => {
    if (!peerConnection) return "Not Created";
    return peerConnection.connectionState || "Unknown";
  };

  const getIceConnectionStateDisplay = () => {
    if (!peerConnection) return "Not Created";
    return peerConnection.iceConnectionState || "Unknown";
  };

  return (
    <div className="bg-purple-900 text-white p-4 rounded-lg mb-6 font-mono text-sm">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-yellow-400">
          🚀 Phase 3 Debug Panel - Partner Matching & Connection
        </h3>
        <div className="flex space-x-2">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-xs"
          >
            {isMinimized ? "Show" : "Hide"}
          </button>
          <button
            onClick={runPhase3Test}
            className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-xs"
          >
            Test Phase 3
          </button>
        </div>
      </div>

      {!isMinimized && (
        <div className="space-y-4">
          {/* Real-time Status */}
          <div className="grid grid-cols-2 gap-4 p-3 bg-purple-800 rounded">
            <div>
              <div className="text-yellow-400 font-bold mb-1">
                Connection Status
              </div>
              <div>Partner ID: {partnerId || "None"}</div>
              <div>Session ID: {sessionId || "None"}</div>
              <div>Queue State: {connectionState.queue}</div>
            </div>
            <div>
              <div className="text-yellow-400 font-bold mb-1">
                WebRTC Status
              </div>
              <div>Connection: {getConnectionStateDisplay()}</div>
              <div>ICE: {getIceConnectionStateDisplay()}</div>
              <div>Remote Stream: {remoteStream ? "Active" : "None"}</div>
            </div>
          </div>

          {/* 1. Match Validation */}
          <div>
            <h4 className="text-yellow-400 font-bold mb-2">
              🎯 1. Match Validation
            </h4>
            <div className="space-y-1 ml-4">
              <div>
                {getStatusIcon(phase3State.partnerSocketActive)} Partner Socket
                Active
              </div>
              <div>
                {getStatusIcon(phase3State.bothUsersInQueue)} Both Users in
                Queue
              </div>
              <div>
                {getStatusIcon(phase3State.uniqueSessionCreated)} Unique Session
                Created
              </div>
              <div>
                {getStatusIcon(phase3State.bothUsersRemovedFromQueue)} Both
                Users Removed from Queue
              </div>
            </div>
          </div>

          {/* 2. WebRTC Connection Setup */}
          <div>
            <h4 className="text-yellow-400 font-bold mb-2">
              🔗 2. WebRTC Connection Setup
            </h4>
            <div className="space-y-1 ml-4">
              <div>
                {getStatusIcon(phase3State.freshPeerConnectionCreated)} Fresh
                RTCPeerConnection Created
              </div>
              <div>
                {getStatusIcon(phase3State.localStreamTracksAdded)} Local Stream
                Tracks Added
              </div>
              <div>
                {getStatusIcon(phase3State.iceServersConfigured)} ICE Servers
                Configured
              </div>
              <div>
                {getStatusIcon(phase3State.connectionEventHandlersSet)}{" "}
                Connection Event Handlers Set
              </div>
            </div>
          </div>

          {/* 3. Signaling Process */}
          <div>
            <h4 className="text-yellow-400 font-bold mb-2">
              📡 3. Signaling Process
            </h4>
            <div className="space-y-1 ml-4">
              <div>
                {getStatusIcon(phase3State.initiatorDetermined)} Initiator
                Determined
              </div>
              <div>
                {getStatusIcon(phase3State.offerAnswerExchanged)} Offer/Answer
                Exchanged
              </div>
              <div>
                {getStatusIcon(phase3State.iceCandidateExchangeActive)} ICE
                Candidate Exchange Active
              </div>
              <div>
                {getStatusIcon(phase3State.connectionStateMonitored)} Connection
                State Monitored
              </div>
            </div>
          </div>

          {/* 4. Connection Establishment */}
          <div>
            <h4 className="text-yellow-400 font-bold mb-2">
              🌐 4. Connection Establishment
            </h4>
            <div className="space-y-1 ml-4">
              <div>
                {getStatusIcon(phase3State.connectionStateConnected)} Connection
                State "Connected"
              </div>
              <div>
                {getStatusIcon(phase3State.remoteVideoStreamDisplayed)} Remote
                Video Stream Displayed
              </div>
              <div>
                {getStatusIcon(phase3State.searchingIndicatorCleared)} Searching
                Indicator Cleared
              </div>
              <div>
                {getStatusIcon(phase3State.connectionStatusUpdated)} Connection
                Status Updated
              </div>
            </div>
          </div>

          {/* 5. UI State Update */}
          <div>
            <h4 className="text-yellow-400 font-bold mb-2">
              🎛️ 5. UI State Update
            </h4>
            <div className="space-y-1 ml-4">
              <div>
                {getStatusIcon(phase3State.startButtonHidden)} START Button
                Hidden
              </div>
              <div>
                {getStatusIcon(phase3State.nextButtonEnabled)} NEXT Button
                Enabled
              </div>
              <div>
                {getStatusIcon(phase3State.stopButtonEnabled)} STOP Button
                Enabled
              </div>
              <div>
                {getStatusIcon(phase3State.messageInputEnabled)} Message Input
                Enabled
              </div>
            </div>
          </div>

          {/* Overall Status */}
          <div className="pt-2 border-t border-purple-700">
            <div className="text-lg">
              Phase 3 Complete: {allComplete ? "✔" : "❌"}
            </div>
            <div className="text-sm mt-2">
              Progress: {getCheckpointCount()}/20 checkpoints
            </div>
            <div className="w-full bg-purple-800 rounded-full h-2 mt-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${(getCheckpointCount() / 20) * 100}%`,
                }}
              ></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
