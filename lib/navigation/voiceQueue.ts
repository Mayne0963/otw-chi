export const VOICE_GUIDANCE_STORAGE_KEY = "otw.voice-guidance-enabled";

export type VoiceRequest = {
  text: string;
  lang: string;
  volume?: number;
  voice?: SpeechSynthesisVoice | null;
  rate?: number;
  flush?: boolean;
};

export type VoiceQueueResult = {
  accepted: boolean;
  reason?: "unavailable" | "disabled" | "blocked";
};

export type VoiceQueue = {
  enqueue: (request: VoiceRequest) => VoiceQueueResult;
  cancel: () => void;
  setEnabled: (enabled: boolean) => void;
  setDefaults: (defaults: Partial<Omit<VoiceRequest, "text" | "flush">>) => void;
  unlock: () => void;
  isBlocked: () => boolean;
};

type VoiceDefaults = {
  lang: string;
  volume: number;
  voice?: SpeechSynthesisVoice | null;
  rate?: number;
};

export const createVoiceQueue = (): VoiceQueue => {
  const synth =
    typeof window !== "undefined" && "speechSynthesis" in window
      ? window.speechSynthesis
      : null;

  let enabled = true;
  let gestureUnlocked = false;
  let speaking = false;
  let queue: VoiceRequest[] = [];
  let defaults: VoiceDefaults = { lang: "en-US", volume: 0.8 };

  const resetState = () => {
    speaking = false;
  };

  const speakNext = () => {
    if (!synth || !gestureUnlocked || !enabled) return;
    if (speaking) return;
    const next = queue.shift();
    if (!next) return;

    const utterance = new SpeechSynthesisUtterance(next.text);
    utterance.lang = next.lang || defaults.lang;
    utterance.volume =
      typeof next.volume === "number"
        ? Math.max(0, Math.min(1, next.volume))
        : defaults.volume;
    if (next.voice) utterance.voice = next.voice;
    if (typeof next.rate === "number" && next.rate > 0) {
      utterance.rate = next.rate;
    } else if (typeof defaults.rate === "number" && defaults.rate > 0) {
      utterance.rate = defaults.rate;
    }

    speaking = true;
    const handleDone = () => {
      resetState();
      speakNext();
    };
    utterance.onend = handleDone;
    utterance.onerror = handleDone;
    synth.speak(utterance);
  };

  const enqueue = (request: VoiceRequest): VoiceQueueResult => {
    if (!synth) return { accepted: false, reason: "unavailable" };
    if (!enabled) return { accepted: false, reason: "disabled" };

    const payload: VoiceRequest = {
      lang: defaults.lang,
      volume: defaults.volume,
      voice: defaults.voice,
      rate: defaults.rate,
      ...request,
    };

    if (payload.flush) {
      queue = [];
      synth.cancel();
      resetState();
    }

    queue.push(payload);
    if (!gestureUnlocked) return { accepted: false, reason: "blocked" };
    speakNext();
    return { accepted: true };
  };

  const cancel = () => {
    queue = [];
    if (synth) synth.cancel();
    resetState();
  };

  const setEnabled = (next: boolean) => {
    enabled = next;
    if (!enabled) {
      cancel();
      return;
    }
    speakNext();
  };

  const setDefaults = (next: Partial<Omit<VoiceRequest, "text" | "flush">>) => {
    defaults = { ...defaults, ...next };
  };

  const unlock = () => {
    gestureUnlocked = true;
    speakNext();
  };

  const isBlocked = () => !gestureUnlocked;

  return { enqueue, cancel, setEnabled, setDefaults, unlock, isBlocked };
};
