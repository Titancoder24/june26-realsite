import {
  isElevenLabsWalkthroughLanguageCode,
  type ElevenLabsWalkthroughLanguageCode,
} from "@/lib/elevenlabs-languages";

/** Short premium opening — no room lists, pricing, or mic instructions. */
export function buildWalkthroughFirstMessage(
  propertyName: string,
  projectName?: string,
  languageCode?: string,
): string {
  const place = projectName?.trim()
    ? `${propertyName.trim()} at ${projectName.trim()}`
    : propertyName.trim() || "this property";

  const code =
    languageCode && isElevenLabsWalkthroughLanguageCode(languageCode) ? languageCode : "en";

  const localized = GREETING_BY_LANGUAGE[code];
  if (localized) return localized(place);

  return GREETING_BY_LANGUAGE.en(place);
}

const GREETING_BY_LANGUAGE: Record<ElevenLabsWalkthroughLanguageCode, (place: string) => string> = {
  en: (place) =>
    `Welcome to ${place}. I'll be your virtual guide today. Ask me about any room, amenity, or feature — or tell me where you'd like to go.`,
  es: (place) =>
    `¡Hola! Bienvenido a ${place}. Activa el micrófono y dime qué quieres ver primero.`,
  fr: (place) =>
    `Salut ! Bienvenue à ${place}. Active le micro et dis-moi ce que tu veux voir en premier !`,
  de: (place) =>
    `Hey! Willkommen bei ${place}. Schalte das Mikro ein und sag mir, was du zuerst sehen möchtest!`,
  pt: (place) =>
    `Olá! Bem-vindo a ${place}. Ligue o microfone e diga o que quer ver primeiro!`,
  it: (place) =>
    `Ciao! Benvenuto a ${place}. Accendi il microfono e dimmi cosa vuoi vedere per primo!`,
  ja: (place) =>
    `こんにちは！${place}へようこそ。マイクをオンにして、最初に見たい場所を教えてください！`,
  ko: (place) =>
    `안녕하세요! ${place}에 오신 것을 환영합니다. 마이크를 켜고 먼저 보고 싶은 곳을 말해주세요!`,
  ar: (place) =>
    `مرحبًا! أهلاً بك في ${place}. فعّل الميكروفون وقل لي ما تريد أن تراه أولاً!`,
  zh: (place) =>
    `你好！欢迎来到${place}。打开麦克风，告诉我你想先看哪里！`,
  hi: (place) =>
    `नमस्ते! ${place} में आपका स्वागत है। माइक चालू करें और बताइए पहले कहाँ जाना है!`,
  ur: (place) =>
    `السلام علیکم! ${place} میں خوش آمدید۔ مائک آن کریں اور بتائیں پہلے کہاں جانا ہے!`,
  ta: (place) =>
    `வணக்கம்! ${place} வரவேற்கிறோம். மைக் ஆன் செய்து முதலில் எங்கே போகலாம் சொல்லுங்கள்!`,
  te: (place) =>
    `నమస్కారం! ${place} స్వాగతం. మైక్ ఆన్ చేసి ముందు ఎక్కడ చూడాలో చెప్పండి!`,
  kn: (place) =>
    `ನಮಸ್ಕಾರ! ${place} ಸ್ವಾಗತ. ಮೈಕ್ ಆನ್ ಮಾಡಿ ಮೊದಲು ಎಲ್ಲಿ ಹೋಗಬೇಕು ಹೇಳಿ!`,
  ml: (place) =>
    `നമസ്കാരം! ${place} സ്വാഗതം. മൈക്ക് ഓൺ ചെയ്ത് ആദ്യം എവിടെ പോകണം പറയൂ!`,
  mr: (place) =>
    `नमस्कार! ${place} मध्ये स्वागत आहे. माइक चालू करा आणि प्रथम कुठे जायचे ते सांगा!`,
  pa: (place) =>
    `ਸਤ ਸ੍ਰੀ ਅਕਾਲ! ${place} ਵਿੱਚ ਜੀ ਆਇਆਂ ਨੂੰ। ਮਾਈਕ ਚਾਲੂ ਕਰੋ ਅਤੇ ਪਹਿਲਾਂ ਕਿੱਥੇ ਜਾਣਾ ਹੈ ਦੱਸੋ!`,
  gu: (place) =>
    `નમસ્તે! ${place} માં આપનું સ્વાગત છે. માઇક ચાલુ કરો અને પહેલા ક્યાં જવું છે કહો!`,
  bho: (place) =>
    `नमस्कार! ${place} में आपका स्वागत बा। माइक चालू करीं और पहिले कहाँ जाए के बा बताईं!`,
};

export const WALKTHROUGH_VOICE_AGENT_PROMPT_TAIL = `
Opening & tone:
- Your FIRST message must be a short, premium welcome only — never list rooms, amenities, pricing, carpet area, or property facts in the opening.
- Do not ask the buyer to enable a microphone or press any button.
- Wait for the buyer to speak before sharing property details. Let them lead.
- Be warm, conversational, and professional — ask what they want to see or know next.
- Keep replies brief and voice-friendly. One idea per turn when possible.

Facts & safety:
- Use ONLY knowledge_summary and get_property_info for property facts.
- Never invent prices, possession dates, RERA status, or offers.
- If information is missing, say you do not have that detail and offer to connect with sales.

Navigation:
- jump_to_scene when the buyer wants to visit a room
- pause_tour / resume_tour for autoplay control

Language:
- Respond in the buyer's language (Hindi, Urdu, Tamil, Telugu, Kannada, Malayalam, Marathi, Punjabi, Gujarati, Bhojpuri, English, and other configured languages).
`;
