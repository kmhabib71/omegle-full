"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";

interface VoiceMessageRecorderProps {
  onRecord: (audioBlob: Blob) => void;
  onCancel: () => void;
  maxDuration?: number; // in seconds
}

export function VoiceMessageRecorder({
  onRecord,
  onCancel,
  maxDuration = 60
}: VoiceMessageRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Reset component state
  const resetRecording = () => {
    setIsRecording(false);
    setRecordingTime(0);
    setAudioBlob(null);
    setAudioUrl(null);
    setIsPreviewing(false);
    audioChunksRef.current = [];

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
  };

  // Start recording audio
  const startRecording = async () => {
    try {
      resetRecording();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);

      mediaRecorderRef.current.addEventListener("dataavailable", (event) => {
        audioChunksRef.current.push(event.data);
      });

      mediaRecorderRef.current.addEventListener("stop", () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const audioUrl = URL.createObjectURL(audioBlob);

        setAudioBlob(audioBlob);
        setAudioUrl(audioUrl);
        setIsRecording(false);

        // Stop all audio tracks
        stream.getAudioTracks().forEach(track => track.stop());
      });

      // Start recording
      mediaRecorderRef.current.start();
      setIsRecording(true);

      // Start recording timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prevTime => {
          if (prevTime >= maxDuration - 1) {
            // Auto-stop if max duration reached
            stopRecording();
            return maxDuration;
          }
          return prevTime + 1;
        });
      }, 1000);

    } catch (error) {
      console.error("Error starting recording:", error);
      alert("Could not access microphone. Please check permissions.");
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  // Play recorded audio
  const playAudio = () => {
    if (audioUrl && audioPlayerRef.current) {
      setIsPreviewing(true);
      audioPlayerRef.current.play();
    }
  };

  // Pause audio playback
  const pauseAudio = () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      setIsPreviewing(false);
    }
  };

  // Send recorded audio message
  const sendAudio = () => {
    if (audioBlob) {
      onRecord(audioBlob);
      resetRecording();
    }
  };

  // Cancel recording
  const cancelRecording = () => {
    resetRecording();
    onCancel();
  };

  // Format seconds as mm:ss
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }

      // Stop recording if in progress
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
      }
    };
  }, [audioUrl, isRecording]);

  // Handle audio player events
  useEffect(() => {
    const audioPlayer = audioPlayerRef.current;

    if (audioPlayer) {
      const handleEnded = () => {
        setIsPreviewing(false);
      };

      audioPlayer.addEventListener('ended', handleEnded);

      return () => {
        audioPlayer.removeEventListener('ended', handleEnded);
      };
    }
  }, []);

  return (
    <div className="p-4 bg-zinc-900 rounded-lg">
      {/* Audio player (hidden) */}
      <audio ref={audioPlayerRef} src={audioUrl || undefined} />

      <div className="text-center mb-4">
        <h3 className="text-white font-medium">Voice Message</h3>
        <p className="text-zinc-400 text-sm">
          {isRecording ? "Recording in progress..." : audioUrl ? "Recording complete" : "Ready to record"}
        </p>
      </div>

      {/* Recording visualization */}
      <div className="flex items-center justify-center mb-4">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center ${isRecording ? 'bg-red-600 animate-pulse' : 'bg-zinc-800'}`}>
          {isRecording ? (
            <span className="text-white text-xl font-bold">{formatTime(recordingTime)}</span>
          ) : audioUrl ? (
            <button onClick={isPreviewing ? pauseAudio : playAudio} className="text-white">
              {isPreviewing ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </button>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          )}
        </div>
      </div>

      {/* Recording time indicator */}
      {!isRecording && audioUrl && (
        <div className="text-center mb-4">
          <span className="text-zinc-400 text-sm">
            {formatTime(recordingTime)} {isPreviewing && '(playing...)'}
          </span>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex justify-center space-x-3">
        {isRecording ? (
          <>
            <Button
              onClick={stopRecording}
              className="bg-red-600 hover:bg-red-700 text-white flex items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
              </svg>
              Stop
            </Button>
            <Button
              onClick={cancelRecording}
              className="bg-zinc-700 hover:bg-zinc-600 text-white"
            >
              Cancel
            </Button>
          </>
        ) : audioUrl ? (
          <>
            <Button
              onClick={sendAudio}
              className="bg-blue-600 hover:bg-blue-700 text-white flex items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              Send
            </Button>
            <Button
              onClick={resetRecording}
              className="bg-zinc-700 hover:bg-zinc-600 text-white"
            >
              Re-record
            </Button>
            <Button
              onClick={cancelRecording}
              className="bg-zinc-800 hover:bg-zinc-700 text-white"
            >
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button
              onClick={startRecording}
              className="bg-blue-600 hover:bg-blue-700 text-white flex items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              Start Recording
            </Button>
            <Button
              onClick={cancelRecording}
              className="bg-zinc-700 hover:bg-zinc-600 text-white"
            >
              Cancel
            </Button>
          </>
        )}
      </div>

      {/* Max duration info */}
      {!audioUrl && (
        <div className="text-center mt-3">
          <p className="text-zinc-500 text-xs">
            {isRecording ?
              `Max duration: ${formatTime(maxDuration)} (${formatTime(maxDuration - recordingTime)} remaining)` :
              `Max recording duration: ${formatTime(maxDuration)}`
            }
          </p>
        </div>
      )}
    </div>
  );
}

// Audio Message Player Component
interface AudioMessageProps {
  audioUrl: string;
  sender: 'user' | 'other';
  timestamp: string;
}

export function AudioMessage({ audioUrl, sender, timestamp }: AudioMessageProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Format seconds as mm:ss
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Play/pause the audio
  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
    }
  };

  // Update audio time display
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  // Get audio duration when metadata is loaded
  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  // Handle audio player events
  useEffect(() => {
    const audioPlayer = audioRef.current;

    if (audioPlayer) {
      audioPlayer.addEventListener('play', () => setIsPlaying(true));
      audioPlayer.addEventListener('pause', () => setIsPlaying(false));
      audioPlayer.addEventListener('ended', () => setIsPlaying(false));
      audioPlayer.addEventListener('timeupdate', handleTimeUpdate);
      audioPlayer.addEventListener('loadedmetadata', handleLoadedMetadata);

      return () => {
        audioPlayer.removeEventListener('play', () => setIsPlaying(true));
        audioPlayer.removeEventListener('pause', () => setIsPlaying(false));
        audioPlayer.removeEventListener('ended', () => setIsPlaying(false));
        audioPlayer.removeEventListener('timeupdate', handleTimeUpdate);
        audioPlayer.removeEventListener('loadedmetadata', handleLoadedMetadata);
      };
    }
  }, []);

  return (
    <div className={`max-w-[80%] ${sender === 'user' ? 'ml-auto' : 'mr-auto'} mb-2`}>
      <div
        className={`rounded-lg p-3 ${
          sender === 'user' ? 'bg-blue-600 text-white' : 'bg-zinc-700 text-white'
        }`}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={togglePlay}
            className="flex-shrink-0 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center"
          >
            {isPlaying ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
            )}
          </button>

          <div className="flex-grow">
            <div className="relative h-1 bg-white/20 rounded overflow-hidden">
              <div
                className="absolute top-0 left-0 h-full bg-white/60"
                style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
              ></div>
            </div>
          </div>

          <div className="flex-shrink-0 text-xs">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </div>

        <audio ref={audioRef} src={audioUrl} preload="metadata" />
      </div>

      <div className={`text-xs text-gray-400 mt-1 ${sender === 'user' ? 'text-right' : 'text-left'}`}>
        {timestamp}
      </div>
    </div>
  );
}
