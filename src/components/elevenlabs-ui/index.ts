/**
 * ElevenLabs UI component layer — re-exports from shadcn/ui paths.
 * Source: https://github.com/elevenlabs/ui
 */
export { Orb, type AgentState } from "@/components/ui/orb";
export {
  Waveform,
  ScrollingWaveform,
  AudioScrubber,
  MicrophoneWaveform,
  StaticWaveform,
  LiveMicrophoneWaveform,
  RecordingWaveform,
} from "@/components/ui/waveform";
export { LiveWaveform } from "@/components/ui/live-waveform";
export { ShimmeringText } from "@/components/ui/shimmering-text";
export {
  AudioPlayerProvider,
  AudioPlayerProgress,
  AudioPlayerDuration,
  AudioPlayerTime,
  AudioPlayerButton,
  AudioPlayerSpeed,
  AudioPlayerSpeedButtonGroup,
  useAudioPlayer,
  useAudioPlayerTime,
} from "@/components/ui/audio-player";
export {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ui/conversation";
export { Message, MessageContent, MessageAvatar } from "@/components/ui/message";
export { Response } from "@/components/ui/response";
export {
  BarVisualizer,
  useAudioVolume,
  useMultibandVolume,
  useBarAnimator,
} from "@/components/ui/bar-visualizer";
export { Matrix } from "@/components/ui/matrix";
export { VoicePicker } from "@/components/ui/voice-picker";
export { VoiceButton, type VoiceButtonState } from "@/components/ui/voice-button";
export { ConversationBar } from "@/components/ui/conversation-bar";
export { MicSelector } from "@/components/ui/mic-selector";
export {
  TranscriptViewerContainer,
  TranscriptViewerWords,
  TranscriptViewerWord,
  TranscriptViewerAudio,
  TranscriptViewerPlayPauseButton,
  TranscriptViewerScrubBar,
  TranscriptViewerProvider,
  useTranscriptViewerContext,
} from "@/components/ui/transcript-viewer";
export {
  ScrubBarContainer,
  ScrubBarTrack,
  ScrubBarProgress,
  ScrubBarThumb,
  ScrubBarTimeLabel,
} from "@/components/ui/scrub-bar";
export {
  SpeechInput,
  SpeechInputRecordButton,
  SpeechInputPreview,
  SpeechInputCancelButton,
  useSpeechInput,
} from "@/components/ui/speech-input";
