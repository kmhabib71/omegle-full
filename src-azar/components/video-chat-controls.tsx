"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Video, VideoOff, Volume2, VolumeX } from "lucide-react";

interface VideoChatControlsProps {
  onVoiceActivationToggle?: (enabled: boolean) => void;
  onCameraToggle?: (enabled: boolean) => void;
  onMicToggle?: (enabled: boolean) => void;
  onPushToTalkStart?: () => void;
  onPushToTalkEnd?: () => void;
  initialVoiceActivation?: boolean;
  initialCameraEnabled?: boolean;
  initialMicEnabled?: boolean;
}

export function VideoChatControls({
  onVoiceActivationToggle,
  onCameraToggle,
  onMicToggle,
  onPushToTalkStart,
  onPushToTalkEnd,
  initialVoiceActivation = false,
  initialCameraEnabled = true,
  initialMicEnabled = true,
}: VideoChatControlsProps) {
  const [voiceActivationEnabled, setVoiceActivationEnabled] = useState(
    initialVoiceActivation
  );
  const [cameraEnabled, setCameraEnabled] = useState(initialCameraEnabled);
  const [micEnabled, setMicEnabled] = useState(initialMicEnabled);
  const [isPushToTalkActive, setIsPushToTalkActive] = useState(false);
  const [isHoldingT, setIsHoldingT] = useState(false);

  const pushToTalkRef = useRef<boolean>(false);

  // Handle keyboard events for push-to-talk
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "t" && !event.repeat) {
        setIsHoldingT(true);
        setIsPushToTalkActive(true);
        pushToTalkRef.current = true;
        onPushToTalkStart?.();
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "t") {
        setIsHoldingT(false);
        setIsPushToTalkActive(false);
        pushToTalkRef.current = false;
        onPushToTalkEnd?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [onPushToTalkStart, onPushToTalkEnd]);

  // Handle voice activation toggle
  const handleVoiceActivationToggle = useCallback(() => {
    const newState = !voiceActivationEnabled;
    setVoiceActivationEnabled(newState);
    onVoiceActivationToggle?.(newState);
  }, [voiceActivationEnabled, onVoiceActivationToggle]);

  // Handle camera toggle
  const handleCameraToggle = useCallback(() => {
    const newState = !cameraEnabled;
    setCameraEnabled(newState);
    onCameraToggle?.(newState);
  }, [cameraEnabled, onCameraToggle]);

  // Handle microphone toggle
  const handleMicToggle = useCallback(() => {
    const newState = !micEnabled;
    setMicEnabled(newState);
    onMicToggle?.(newState);
  }, [micEnabled, onMicToggle]);

  // Handle mouse-based push-to-talk
  const handlePushToTalkMouseDown = useCallback(() => {
    if (!pushToTalkRef.current) {
      setIsPushToTalkActive(true);
      pushToTalkRef.current = true;
      onPushToTalkStart?.();
    }
  }, [onPushToTalkStart]);

  const handlePushToTalkMouseUp = useCallback(() => {
    if (pushToTalkRef.current && !isHoldingT) {
      setIsPushToTalkActive(false);
      pushToTalkRef.current = false;
      onPushToTalkEnd?.();
    }
  }, [onPushToTalkEnd, isHoldingT]);

  return (
    <div className="flex items-center justify-center gap-4 p-4 rounded-lg shadow-lg">
      {/* Voice Activation Toggle */}
      <div className="flex flex-col items-center">
        <Button
          onClick={handleVoiceActivationToggle}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 ${
            voiceActivationEnabled
              ? "bg-green-500 hover:bg-green-600 text-white"
              : "bg-gray-600 hover:bg-gray-700 text-gray-300"
          }`}
          title="Voice Activation"
        >
          {voiceActivationEnabled ? (
            <Volume2 size={20} />
          ) : (
            <VolumeX size={20} />
          )}
        </Button>
        <span className="text-xs text-white mt-1">Voice Activation</span>
        {voiceActivationEnabled && (
          <div className="w-2 h-2 bg-green-400 rounded-full mt-1 animate-pulse" />
        )}
      </div>

      {/* Camera Toggle */}
      {initialCameraEnabled && (
        <div className="flex flex-col items-center">
          <Button
            onClick={handleCameraToggle}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 ${
              cameraEnabled
                ? "bg-blue-500 hover:bg-blue-600 text-white"
                : "bg-red-500 hover:bg-red-600 text-white"
            }`}
            title={cameraEnabled ? "Turn off camera" : "Turn on camera"}
          >
            {cameraEnabled ? <Video size={20} /> : <VideoOff size={20} />}
          </Button>
          <span className="text-xs text-white mt-1">
            {cameraEnabled ? "Camera On" : "Camera Off"}
          </span>
        </div>
      )}

      {/* Microphone Toggle */}
      <div className="flex flex-col items-center">
        <Button
          onClick={handleMicToggle}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 ${
            micEnabled
              ? "bg-blue-500 hover:bg-blue-600 text-white"
              : "bg-red-500 hover:bg-red-600 text-white"
          }`}
          title={micEnabled ? "Mute microphone" : "Unmute microphone"}
        >
          {micEnabled ? <Mic size={20} /> : <MicOff size={20} />}
        </Button>
        <span className="text-xs text-white mt-1">
          {micEnabled ? "Mic On" : "Mic Off"}
        </span>
      </div>

      {/* Push to Talk Button */}
      <div className="flex flex-col items-center">
        <Button
          onMouseDown={handlePushToTalkMouseDown}
          onMouseUp={handlePushToTalkMouseUp}
          onMouseLeave={handlePushToTalkMouseUp}
          className={`w-16 h-12 rounded-lg flex items-center justify-center transition-all duration-200 ${
            isPushToTalkActive
              ? "bg-green-500 hover:bg-green-600 text-white shadow-lg scale-105"
              : "bg-gray-600 hover:bg-gray-700 text-gray-300"
          }`}
          title="Push to talk or Hold 'T'"
        >
          <div className="flex flex-col items-center">
            <Mic size={16} />
            <span className="text-xs font-bold">T</span>
          </div>
        </Button>
        <span className="text-xs text-white mt-1">
          {isPushToTalkActive ? (
            <span className="text-green-300 animate-pulse">
              {isHoldingT ? "Hold 'T'" : "Push to talk"}
            </span>
          ) : (
            "Push to talk or Hold 'T'"
          )}
        </span>
      </div>
    </div>
  );
}
