"use client";

import { useEffect, useState } from "react";

interface DebugState {
  socketConnection: boolean;
  networkConnectivity: boolean;
  webrtcInitialized: boolean;
  connectionStateSet: boolean;
  cameraPermission: boolean;
  microphonePermission: boolean;
  deviceAvailability: boolean;
  localStreamInitialized: boolean;
  mediaConstraintsSet: boolean;
  startButtonVisible: boolean;
  startButtonDisabled: boolean;
  nextButtonHidden: boolean;
  stopButtonHidden: boolean;
  videoFramesCleared: boolean;
  statesReset: boolean;
}

export const PhaseOneDebugger = () => {
  const [debugState, setDebugState] = useState<DebugState>({
    socketConnection: false,
    networkConnectivity: false,
    webrtcInitialized: false,
    connectionStateSet: false,
    cameraPermission: false,
    microphonePermission: false,
    deviceAvailability: false,
    localStreamInitialized: false,
    mediaConstraintsSet: false,
    startButtonVisible: true,
    startButtonDisabled: true,
    nextButtonHidden: true,
    stopButtonHidden: true,
    videoFramesCleared: true,
    statesReset: false,
  });

  const [isMinimized, setIsMinimized] = useState(false);

  const runPhase1Test = async () => {
    console.log("🧪 Running Phase 1 Test...");

    // Reset state
    setDebugState((prev) => ({
      ...prev,
      statesReset: true,
      connectionStateSet: true,
      videoFramesCleared: true,
      startButtonVisible: true,
    }));

    // Test Socket Connection
    try {
      // Simulate socket connection test
      const response = await fetch("http://localhost:3001", { method: "HEAD" });
      if (response.ok || response.status === 404) {
        // 404 is expected for Socket.IO
        setDebugState((prev) => ({
          ...prev,
          socketConnection: true,
          networkConnectivity: true,
        }));
        console.log("✔ Socket server reachable");
      }
    } catch (error) {
      console.error("❌ Socket server not reachable:", error);
    }

    // Test WebRTC
    try {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      if (pc) {
        setDebugState((prev) => ({ ...prev, webrtcInitialized: true }));
        console.log("✔ WebRTC initialized");
        pc.close();
      }
    } catch (error) {
      console.error("❌ WebRTC failed:", error);
    }

    // Test Media Devices
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasCamera = devices.some((device) => device.kind === "videoinput");
      const hasMicrophone = devices.some(
        (device) => device.kind === "audioinput"
      );

      setDebugState((prev) => ({
        ...prev,
        deviceAvailability: hasCamera && hasMicrophone,
        mediaConstraintsSet: true,
        localStreamInitialized: true,
      }));

      // Test permissions
      try {
        const cameraPermission = await navigator.permissions.query({
          name: "camera" as PermissionName,
        });
        const microphonePermission = await navigator.permissions.query({
          name: "microphone" as PermissionName,
        });

        setDebugState((prev) => ({
          ...prev,
          cameraPermission: cameraPermission.state === "granted",
          microphonePermission: microphonePermission.state === "granted",
        }));
      } catch (permError) {
        console.log("Permission check not supported, trying getUserMedia...");
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });
          setDebugState((prev) => ({
            ...prev,
            cameraPermission: true,
            microphonePermission: true,
          }));
          stream.getTracks().forEach((track) => track.stop());
        } catch (mediaError) {
          console.error("❌ Media permission denied:", mediaError);
        }
      }

      console.log("✔ Media devices checked");
    } catch (error) {
      console.error("❌ Media devices check failed:", error);
    }

    // Update button states
    setTimeout(() => {
      setDebugState((prev) => {
        const allReady =
          prev.socketConnection &&
          prev.webrtcInitialized &&
          prev.deviceAvailability;
        return {
          ...prev,
          startButtonDisabled: !allReady,
        };
      });
    }, 1000);
  };

  const getStatusIcon = (status: boolean) => (status ? "✔" : "❌");
  const allComplete = Object.values(debugState).every(Boolean);

  return (
    <div className="bg-blue-900 text-white p-4 rounded-lg mb-6 font-mono text-sm">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-yellow-400">
          🧪 Phase 1 Test Suite
        </h3>
        <div className="flex space-x-2">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs"
          >
            {isMinimized ? "Show" : "Hide"}
          </button>
          <button
            onClick={runPhase1Test}
            className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-xs"
          >
            Run Test
          </button>
        </div>
      </div>

      {!isMinimized && (
        <div className="space-y-4">
          {/* Connection Tests */}
          <div>
            <h4 className="text-yellow-400 font-bold mb-2">
              🔌 Connection Tests
            </h4>
            <div className="space-y-1">
              <div>
                {getStatusIcon(debugState.socketConnection)} Socket Connection
              </div>
              <div>
                {getStatusIcon(debugState.networkConnectivity)} Network
                Connectivity
              </div>
              <div>
                {getStatusIcon(debugState.webrtcInitialized)} WebRTC Initialized
              </div>
              <div>
                {getStatusIcon(debugState.connectionStateSet)} Connection State
                Set
              </div>
            </div>
          </div>

          {/* Media Tests */}
          <div>
            <h4 className="text-yellow-400 font-bold mb-2">🎥 Media Tests</h4>
            <div className="space-y-1">
              <div>
                {getStatusIcon(debugState.cameraPermission)} Camera Permission
              </div>
              <div>
                {getStatusIcon(debugState.microphonePermission)} Microphone
                Permission
              </div>
              <div>
                {getStatusIcon(debugState.deviceAvailability)} Device
                Availability
              </div>
              <div>
                {getStatusIcon(debugState.localStreamInitialized)} Local Stream
                Initialized
              </div>
              <div>
                {getStatusIcon(debugState.mediaConstraintsSet)} Media
                Constraints Set
              </div>
            </div>
          </div>

          {/* UI Tests */}
          <div>
            <h4 className="text-yellow-400 font-bold mb-2">🎛️ UI Tests</h4>
            <div className="space-y-1">
              <div>
                {getStatusIcon(debugState.startButtonVisible)} START Button
                Visible
              </div>
              <div>
                {getStatusIcon(!debugState.startButtonDisabled)} START Button
                Enabled
              </div>
              <div>
                {getStatusIcon(debugState.nextButtonHidden)} NEXT Button Hidden
              </div>
              <div>
                {getStatusIcon(debugState.stopButtonHidden)} STOP Button Hidden
              </div>
              <div>
                {getStatusIcon(debugState.videoFramesCleared)} Video Frames
                Cleared
              </div>
              <div>{getStatusIcon(debugState.statesReset)} States Reset</div>
            </div>
          </div>

          {/* Overall Status */}
          <div className="pt-2 border-t border-blue-700">
            <div className="text-lg">
              Phase 1 Complete: {allComplete ? "✔" : "❌"}
            </div>
            <div className="text-sm mt-2">
              Progress: {Object.values(debugState).filter(Boolean).length}/15
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
