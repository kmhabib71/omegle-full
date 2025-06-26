"use client";

import { useState } from "react";
import { VideoChatControls } from "@/components/video-chat-controls";
import { EnhancedVideoChat } from "@/components/enhanced-video-chat";
import { VoiceChat } from "@/components/voice-chat";
import { Button } from "@/components/ui/button";
import { Video, Phone, MessageCircle, ArrowLeft } from "lucide-react";

export default function ChatDemoPage() {
  const [activeDemo, setActiveDemo] = useState<
    "controls" | "video" | "voice" | null
  >(null);
  const [isInCall, setIsInCall] = useState(false);

  // Demo handlers for video chat controls
  const handleVoiceActivationToggle = (enabled: boolean) => {
    console.log("Voice activation:", enabled);
  };

  const handleCameraToggle = (enabled: boolean) => {
    console.log("Camera:", enabled);
  };

  const handleMicToggle = (enabled: boolean) => {
    console.log("Microphone:", enabled);
  };

  const handlePushToTalkStart = () => {
    console.log("Push to talk started");
  };

  const handlePushToTalkEnd = () => {
    console.log("Push to talk ended");
  };

  const handleEndCall = () => {
    setIsInCall(false);
    setActiveDemo(null);
  };

  const handleMessageToggle = () => {
    console.log("Message toggle");
  };

  const startVideoCall = () => {
    setActiveDemo("video");
    setIsInCall(true);
  };

  const startVoiceCall = () => {
    setActiveDemo("voice");
    setIsInCall(true);
  };

  if (activeDemo === "video" && isInCall) {
    return (
      <EnhancedVideoChat
        onEndCall={handleEndCall}
        onMessageToggle={handleMessageToggle}
        sessionId="demo-session"
        remoteUserName="Demo User"
      />
    );
  }

  if (activeDemo === "voice" && isInCall) {
    return (
      <VoiceChat
        onEndCall={handleEndCall}
        onMessageToggle={handleMessageToggle}
        sessionId="demo-session"
        remoteUserName="Demo User"
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">
            Video & Voice Chat Demo
          </h1>
          <p className="text-gray-300 text-lg">
            Experience the new video and voice chat functionality with advanced
            controls
          </p>
        </div>

        {/* Demo Options */}
        {activeDemo === null && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            {/* Controls Demo */}
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageCircle size={32} className="text-white" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                Video Chat Controls
              </h3>
              <p className="text-gray-300 mb-4">
                Interactive controls with voice activation, camera/mic toggles,
                and push-to-talk
              </p>
              <Button
                onClick={() => setActiveDemo("controls")}
                className="w-full bg-blue-500 hover:bg-blue-600"
              >
                Try Controls
              </Button>
            </div>

            {/* Video Chat Demo */}
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Video size={32} className="text-white" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                Enhanced Video Chat
              </h3>
              <p className="text-gray-300 mb-4">
                Full-screen video chat with picture-in-picture and advanced
                controls
              </p>
              <Button
                onClick={startVideoCall}
                className="w-full bg-green-500 hover:bg-green-600"
              >
                Start Video Call
              </Button>
            </div>

            {/* Voice Chat Demo */}
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Phone size={32} className="text-white" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                Voice Chat
              </h3>
              <p className="text-gray-300 mb-4">
                Audio-only chat with voice activation and push-to-talk features
              </p>
              <Button
                onClick={startVoiceCall}
                className="w-full bg-purple-500 hover:bg-purple-600"
              >
                Start Voice Call
              </Button>
            </div>
          </div>
        )}

        {/* Controls Demo */}
        {activeDemo === "controls" && (
          <div className="space-y-8">
            <div className="flex items-center mb-6">
              <Button
                onClick={() => setActiveDemo(null)}
                variant="ghost"
                className="text-white hover:bg-white/10"
              >
                <ArrowLeft size={20} className="mr-2" />
                Back to Menu
              </Button>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-8">
              <h2 className="text-2xl font-bold text-white mb-6 text-center">
                Video Chat Controls Demo
              </h2>

              <div className="space-y-6">
                <div className="text-center">
                  <p className="text-gray-300 mb-4">
                    Try the interactive controls below. Use your mouse or
                    keyboard (Hold 'T' for push-to-talk)
                  </p>
                </div>

                <div className="flex justify-center">
                  <VideoChatControls
                    onVoiceActivationToggle={handleVoiceActivationToggle}
                    onCameraToggle={handleCameraToggle}
                    onMicToggle={handleMicToggle}
                    onPushToTalkStart={handlePushToTalkStart}
                    onPushToTalkEnd={handlePushToTalkEnd}
                    initialVoiceActivation={false}
                    initialCameraEnabled={true}
                    initialMicEnabled={true}
                  />
                </div>

                <div className="bg-black/30 rounded-lg p-4 max-w-md mx-auto">
                  <h4 className="text-white font-semibold mb-2">Features:</h4>
                  <ul className="text-gray-300 text-sm space-y-1">
                    <li>✓ Voice Activation Toggle</li>
                    <li>✓ Camera On/Off Control</li>
                    <li>✓ Microphone Mute/Unmute</li>
                    <li>✓ Push-to-Talk (Mouse + Keyboard)</li>
                    <li>✓ Hold 'T' Key for Push-to-Talk</li>
                    <li>✓ Visual Feedback & Animations</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Features Section */}
        <div className="bg-white/5 backdrop-blur-sm rounded-lg p-8">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">
            New Features Added
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">
                Video Chat Features
              </h3>
              <ul className="text-gray-300 space-y-2">
                <li className="flex items-start">
                  <span className="text-green-400 mr-2">✓</span>
                  Full-screen video chat interface
                </li>
                <li className="flex items-start">
                  <span className="text-green-400 mr-2">✓</span>
                  Picture-in-picture local video
                </li>
                <li className="flex items-start">
                  <span className="text-green-400 mr-2">✓</span>
                  Voice activation with visual feedback
                </li>
                <li className="flex items-start">
                  <span className="text-green-400 mr-2">✓</span>
                  Real-time call duration tracking
                </li>
                <li className="flex items-start">
                  <span className="text-green-400 mr-2">✓</span>
                  Camera and microphone controls
                </li>
              </ul>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">
                Voice Chat Features
              </h3>
              <ul className="text-gray-300 space-y-2">
                <li className="flex items-start">
                  <span className="text-green-400 mr-2">✓</span>
                  Audio-only chat interface
                </li>
                <li className="flex items-start">
                  <span className="text-green-400 mr-2">✓</span>
                  Push-to-talk with 'T' key
                </li>
                <li className="flex items-start">
                  <span className="text-green-400 mr-2">✓</span>
                  Voice level visualization
                </li>
                <li className="flex items-start">
                  <span className="text-green-400 mr-2">✓</span>
                  Speaker and microphone controls
                </li>
                <li className="flex items-start">
                  <span className="text-green-400 mr-2">✓</span>
                  Beautiful animated user interface
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Technical Details */}
        <div className="mt-8 bg-white/5 backdrop-blur-sm rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">
            Technical Implementation
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-300">
            <div>
              <h4 className="font-medium text-white mb-2">Components Added:</h4>
              <ul className="space-y-1">
                <li>• VideoChatControls.tsx</li>
                <li>• EnhancedVideoChat.tsx</li>
                <li>• VoiceChat.tsx (enhanced)</li>
                <li>• useWebRTC.ts hook</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-white mb-2">Features:</h4>
              <ul className="space-y-1">
                <li>• WebRTC peer-to-peer connections</li>
                <li>• Real-time audio analysis</li>
                <li>• Keyboard event handling</li>
                <li>• Responsive design</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
