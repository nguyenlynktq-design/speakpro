
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { CEFRLevel, EvaluationResult } from "../types";

// Model fallback order - prioritize stable models with higher rate limits
const TEXT_MODEL_PRIMARY = 'gemini-2.5-flash';  // Stable, higher quota
const TEXT_MODEL_FALLBACKS = [
  'gemini-2.0-flash',       // Fallback 1: Also stable
  'gemini-2.5-flash-lite',  // Fallback 2: Lightweight
];

/**
 * Get API key from localStorage
 */
export function getApiKey(): string {
  return localStorage.getItem('gemini_api_key') || '';
}

/**
 * Get selected model from localStorage  
 */
export function getSelectedModel(): string {
  return localStorage.getItem('gemini_selected_model') || TEXT_MODEL_PRIMARY;
}

/**
 * Save API key and model to localStorage
 */
export function saveApiConfig(apiKey: string, model: string): void {
  localStorage.setItem('gemini_api_key', apiKey);
  localStorage.setItem('gemini_selected_model', model);
}

/**
 * Initialize/reinitialize the Gemini client (for retry after changing key)
 */
export function initializeGeminiChat(apiKey?: string, model?: string): void {
  if (apiKey) {
    localStorage.setItem('gemini_api_key', apiKey);
  }
  if (model) {
    localStorage.setItem('gemini_selected_model', model);
  }
  // Clear any cached clients if needed in future
}

/**
 * Utility to handle retries with exponential backoff for API calls.
 * Specifically handles 429 (Rate Limit) errors.
 */
async function callWithRetry<T>(fn: () => Promise<T>, maxRetries = 4): Promise<T> {
  let delay = 1500; // Start with 1.5s
  let lastError: any = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      const errorStr = JSON.stringify(err).toLowerCase();
      const errorMessage = err?.message?.toLowerCase() || '';

      // Log full error for debugging
      console.error(`[Gemini API] Error attempt ${i + 1}/${maxRetries}:`, err);
      console.error(`[Gemini API] Error message:`, err?.message);
      console.error(`[Gemini API] Error status:`, err?.status);

      const isQuotaError =
        err?.status === 429 ||
        errorMessage.includes('429') ||
        errorStr.includes('quota') ||
        errorStr.includes('resource_exhausted') ||
        errorStr.includes('rate_limit');

      if (isQuotaError && i < maxRetries - 1) {
        console.warn(`[Gemini API] Quota exceeded, retrying in ${delay}ms... (Attempt ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2.5; // Aggressive exponential backoff
        continue;
      }

      // If it's not a quota error, throw immediately with actual message
      if (!isQuotaError) {
        throw new Error(err?.message || `Lỗi API: ${JSON.stringify(err)}`);
      }
    }
  }

  // If we exhausted retries, throw with the actual error message
  const actualMessage = lastError?.message || 'Unknown error';
  if (actualMessage.includes('quota') || actualMessage.includes('429')) {
    throw new Error("MÁY CHỦ BẬN: Ms Ly AI đang phục vụ quá nhiều bạn nhỏ. Bé chờ 30 giây rồi nhấn 'Thử lại' nhé!");
  }
  throw new Error(`Lỗi: ${actualMessage}`);
}

// Pre-encoded static fallback SVG (pure ASCII, no btoa needed)
const FALLBACK_IMAGE_BASE64 = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4MDAiIGhlaWdodD0iNDUwIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImciIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPjxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiM2NjdlZWEiLz48c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiM3NjRiYTIiLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48cmVjdCB3aWR0aD0iODAwIiBoZWlnaHQ9IjQ1MCIgZmlsbD0idXJsKCNnKSIvPjx0ZXh0IHg9IjQwMCIgeT0iMjAwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iNTAiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5MZXQncyBMZWFybiE8L3RleHQ+PHRleHQgeD0iNDAwIiB5PSIyNjAiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIyNCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiPkltYWdpbmUgYSBiZWF1dGlmdWwgcGljdHVyZSBoZXJlPC90ZXh0Pjwvc3ZnPg==';

export const generateIllustration = async (theme: string): Promise<string> => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("Vui lòng nhập API Key để sử dụng app.");

  const ai = new GoogleGenAI({ apiKey });
  const prompt = `A highly vibrant, artistic, and detailed 3D Disney/Pixar style illustration for children showing: ${theme}. Soft lighting, friendly faces, bright colors. High quality.`;

  // Try multiple image models in order (updated list for 2026)
  const imageModels = [
    'gemini-2.0-flash-exp-image-generation',  // Latest exp model
    'imagen-3.0-generate-001',                 // Stable Imagen
    'gemini-2.5-flash-preview-image',          // Preview
    'gemini-2.0-flash-image-generation'        // Fallback
  ];

  for (const model of imageModels) {
    try {
      console.log(`[Image Gen] Trying model: ${model}`);
      const response = await ai.models.generateContent({
        model: model,
        contents: { parts: [{ text: prompt }] },
        config: {
          responseModalities: ['IMAGE', 'TEXT'],
          imageConfig: { aspectRatio: "16:9" }
        }
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          console.log(`[Image Gen] Success with model: ${model}`);
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    } catch (err: any) {
      console.warn(`[Image Gen] Model ${model} failed:`, err?.message);
      continue; // Try next model
    }
  }

  // Fallback: Try to fetch from Unsplash
  console.warn('[Image Gen] All AI models failed, trying Unsplash fallback');
  try {
    const safeQuery = theme.replace(/[^a-zA-Z0-9\s]/g, '').trim() || 'learning children';
    // Use picsum.photos as it's more reliable
    const placeholderUrl = `https://picsum.photos/800/450`;
    const response = await fetch(placeholderUrl);
    if (response.ok) {
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve(FALLBACK_IMAGE_BASE64);
        reader.readAsDataURL(blob);
      });
    }
  } catch (err) {
    console.warn('[Image Gen] Image fetch failed:', err);
  }

  // Ultimate fallback: Return pre-encoded static SVG
  console.warn('[Image Gen] Using static fallback image');
  return FALLBACK_IMAGE_BASE64;
};

export const generatePresentationScript = async (imageUri: string, theme: string, level: CEFRLevel): Promise<any> => {
  return callWithRetry(async () => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("Vui lòng nhập API Key để sử dụng app.");

    const ai = new GoogleGenAI({ apiKey });

    const levelInstructions = {
      'Starters': 'Write exactly 20 words total using 4-5 extremely simple sentences. Use only basic vocabulary (colors, numbers, animals, family). Example structure: "This is a cat. The cat is orange. I like cats."',
      'Movers': 'Write exactly 50 words total using 6-7 simple sentences. Use present tense and common words. Include basic adjectives.',
      'Flyers': 'Write exactly 80 words total using 8-9 sentences. Include feelings and simple descriptions. Use present and past tense.',
      'A1': 'Write 100-120 words total using 10-12 sentences. Focus on clear, simple structures. Use basic vocabulary and simple grammar.',
      'A2': 'Write 150-180 words total using 12-15 sentences. Include some complex sentences. Use varied vocabulary.',
      'B1': 'Write 200-250 words total using 15-18 sentences. Include opinions and reasons. Use connectors and transitions.',
      'B2': 'Write 250-300 words total using 18-22 sentences. Sophisticated analysis with advanced vocabulary and complex structures.',
      'C1': 'Write 300-350 words with academic detail and nuanced expression.',
      'C2': 'Write 350-400 words with mastery-level complexity and eloquence.'
    }[level] || '100-120 words in 10-12 sentences.';

    // Check if image is valid (not SVG fallback)
    const isSvgFallback = imageUri.includes('image/svg+xml') || !imageUri.includes('base64,');
    const isPng = imageUri.includes('image/png');
    const isJpeg = imageUri.includes('image/jpeg') || imageUri.includes('image/jpg');
    const isValidImage = (isPng || isJpeg) && !isSvgFallback;

    let contentParts: any[];

    if (isValidImage) {
      // Use image + text prompt
      const base64Data = imageUri.split(',')[1];
      const mimeType = isPng ? 'image/png' : 'image/jpeg';
      contentParts = [
        { inlineData: { mimeType, data: base64Data } },
        {
          text: `Based on this picture for the topic "${theme}", write a pedagogical English presentation script for a student at ${level} level.
                 
                 STRICT RULES:
                 1. ${levelInstructions}
                 2. CRITICAL: Use proper spacing between ALL words. Never combine words together.
                 3. Each sentence must be complete with proper punctuation and spaces.
                 4. Use normal English text with spaces like: "Hello everyone! Today I want to tell you..."
                 5. DO NOT use double periods.
                 6. Return JSON with: intro, points (array), conclusion.`
        }
      ];
    } else {
      // Use text-only prompt (fallback when image generation failed)
      console.warn('[Script Gen] Using text-only prompt (no valid image)');
      contentParts = [
        {
          text: `Create a pedagogical English presentation script about "${theme}" for a student at ${level} level.
                 
                 STRICT RULES:
                 1. ${levelInstructions}
                 2. CRITICAL: Use proper spacing between ALL words. Never combine words together.
                 3. Each sentence must be complete with proper punctuation and spaces.
                 4. Use normal English text with spaces like: "Hello everyone! Today I want to tell you..."
                 5. DO NOT use double periods.
                 6. Return JSON with: intro, points (array), conclusion.
                 7. Make it engaging and educational for children.`
        }
      ];
    }

    const response = await ai.models.generateContent({
      model: TEXT_MODEL_PRIMARY,
      contents: { parts: contentParts },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            intro: { type: Type.STRING },
            points: { type: Type.ARRAY, items: { type: Type.STRING } },
            conclusion: { type: Type.STRING }
          },
          required: ["intro", "points", "conclusion"]
        }
      }
    });

    return JSON.parse(response.text || '{}');
  });
};

export const generateTeacherVoice = async (text: string): Promise<AudioBuffer> => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("Vui lòng nhập API Key để sử dụng app.");

  const ai = new GoogleGenAI({ apiKey });

  // Try multiple TTS models in order
  const ttsModels = ['gemini-2.5-flash-preview-tts', 'gemini-2.5-pro-preview-tts', 'gemini-2.0-flash-live'];

  for (const model of ttsModels) {
    try {
      console.log(`[TTS] Trying model: ${model}`);
      const response = await ai.models.generateContent({
        model: model,
        contents: [{ parts: [{ text: `Read slowly and clearly: ${text}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } }
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        console.log(`[TTS] Success with model: ${model}`);
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        const decodedData = await decodeAudioData(decode(base64Audio), audioContext, 24000, 1);
        return decodedData;
      }
    } catch (err: any) {
      console.warn(`[TTS] Model ${model} failed:`, err?.message);
      continue;
    }
  }

  // Fallback: Use Web Speech API
  console.warn('[TTS] All Gemini TTS models failed, using Web Speech API fallback');
  throw new Error('TTS_FALLBACK_TO_WEB_SPEECH');
};

export const evaluatePresentation = async (originalScript: string, transcript: string, level: CEFRLevel): Promise<EvaluationResult> => {
  return callWithRetry(async () => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("Vui lòng nhập API Key để sử dụng app.");

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: TEXT_MODEL_PRIMARY,
      contents: `You are a CEFR Speaking Examiner. Evaluate this English presentation reading practice.

TARGET SCRIPT (what student should read):
"${originalScript}"

STUDENT'S SPOKEN CONTENT:
"${transcript}"

EXPECTED LEVEL: ${level}

CRITICAL RULES:
1. This is a READING practice - student must read the TARGET SCRIPT
2. If student speaks OFF-TOPIC (not reading the script), ALL scores = 0
3. Compare student's speech with the target script carefully
4. Use scale 0-10:
   - 9-10: Excellent - Native-like
   - 7-8: Good - Minor errors only  
   - 5-6: Satisfactory - Some errors but understandable
   - 3-4: Developing - Many errors, limited communication
   - 1-2: Limited - Significant difficulty
   - 0: Off-topic or no attempt

EVALUATE ON 6 CEFR SPEAKING CRITERIA:
1. Pronunciation (Phát âm) - Individual sounds, word stress
2. Fluency (Độ trôi chảy) - Smooth delivery, natural pauses
3. Intonation & Stress (Ngữ điệu) - Sentence melody, emphasis
4. Vocabulary (Từ vựng) - Correct word usage from script
5. Grammar (Ngữ pháp) - Accurate sentence structures
6. Task Fulfillment (Hoàn thành bài) - Read correct content, complete the script

Return JSON with:
- pronunciation, fluency, intonation, vocabulary, grammar, taskFulfillment (0-10 each)
- mistakes (array of {word, tip} for pronunciation/grammar errors)
- feedback (Vietnamese, friendly, max 2 sentences)
- teacherPraise (English, encouraging)
- suggestions (2 specific tips in Vietnamese)`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            pronunciation: { type: Type.NUMBER },
            fluency: { type: Type.NUMBER },
            intonation: { type: Type.NUMBER },
            vocabulary: { type: Type.NUMBER },
            grammar: { type: Type.NUMBER },
            taskFulfillment: { type: Type.NUMBER },
            mistakes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: { word: { type: Type.STRING }, tip: { type: Type.STRING } }
              }
            },
            feedback: { type: Type.STRING },
            teacherPraise: { type: Type.STRING },
            suggestions: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["pronunciation", "fluency", "intonation", "vocabulary", "grammar", "taskFulfillment", "mistakes", "feedback", "teacherPraise", "suggestions"]
        }
      }
    });

    const raw = JSON.parse(response.text || '{}');
    const avgScore = (raw.pronunciation + raw.fluency + raw.intonation + raw.vocabulary + raw.grammar + raw.taskFulfillment) / 6;
    const score = Math.round(avgScore * 10) / 10;

    let perceivedLevel = 'A1';
    if (score > 9.0) perceivedLevel = 'C2';
    else if (score > 8.0) perceivedLevel = 'C1';
    else if (score > 6.0) perceivedLevel = 'B2';
    else if (score > 4.0) perceivedLevel = 'B1';
    else if (score > 2.0) perceivedLevel = 'A2';
    else perceivedLevel = 'A1';

    return {
      ...raw,
      score,
      perceivedLevel,
      transcript
    };
  });
};

export function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

// Cache for word meanings to avoid repeated API calls
const wordMeaningCache = new Map<string, { meaning: string; phonetic: string; example: string }>();

/**
 * Get Vietnamese meaning, phonetic, and example for an English word
 */
export const getWordMeaning = async (word: string): Promise<{ meaning: string; phonetic: string; example: string }> => {
  const cleanWord = word.toLowerCase().replace(/[.,!?;:'"()]/g, '').trim();

  // Check cache first
  if (wordMeaningCache.has(cleanWord)) {
    return wordMeaningCache.get(cleanWord)!;
  }

  return callWithRetry(async () => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("Vui lòng nhập API Key để sử dụng app.");

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: TEXT_MODEL_PRIMARY,
      contents: `Provide the Vietnamese translation for the English word "${cleanWord}".
                 Return JSON with:
                 - meaning: Vietnamese meaning (concise, 1-3 words)
                 - phonetic: IPA phonetic transcription (e.g., /ˈæp.əl/)
                 - example: A simple example sentence using this word (in English)
                 
                 Keep responses short and child-friendly.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            meaning: { type: Type.STRING },
            phonetic: { type: Type.STRING },
            example: { type: Type.STRING }
          },
          required: ["meaning", "phonetic", "example"]
        }
      }
    });

    const result = JSON.parse(response.text || '{}');

    // Cache the result
    wordMeaningCache.set(cleanWord, result);

    return result;
  });
};

/**
 * Speak a single word using TTS
 */
export const speakWord = async (word: string): Promise<void> => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("Vui lòng nhập API Key để sử dụng app.");

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Pronounce clearly: ${word}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } }
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) return;

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    const buffer = await decodeAudioData(decode(base64Audio), audioContext, 24000, 1);

    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.start(0);
  } catch (err) {
    // Fallback to Web Speech API
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = 'en-US';
    utterance.rate = 0.8;
    window.speechSynthesis.speak(utterance);
  }
};

export interface ComprehensionQuestionData {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

/**
 * Generate 10 comprehension questions based on the image and script
 */
export const generateComprehensionQuestions = async (
  imageUri: string,
  script: string,
  level: CEFRLevel
): Promise<ComprehensionQuestionData[]> => {
  return callWithRetry(async () => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("Vui lòng nhập API Key để sử dụng app.");

    const ai = new GoogleGenAI({ apiKey });

    const levelInstructions = {
      'Starters': 'Very simple questions with 3 options. Use basic vocabulary (colors, numbers, animals).',
      'Movers': 'Simple questions with 3 options. Use present tense and common words.',
      'Flyers': 'Moderate questions with 4 options. Include some inference questions.',
      'A1': 'Basic questions, 4 options. Focus on factual recall.',
      'A2': 'Elementary questions, 4 options. Some vocabulary questions.',
      'B1': 'Intermediate questions, 4 options. Include inference and vocabulary.',
      'B2': 'Upper-intermediate, 4 options. Analysis and inference questions.',
      'C1': 'Advanced questions, 4 options. Complex inference and critical thinking.',
      'C2': 'Mastery level, 4 options. Nuanced understanding and analysis.'
    }[level] || '4 options, moderate difficulty.';

    // Check if image is valid (not SVG fallback)
    const isSvgFallback = imageUri.includes('image/svg+xml') || !imageUri.includes('base64,');
    const isPng = imageUri.includes('image/png');
    const isJpeg = imageUri.includes('image/jpeg') || imageUri.includes('image/jpg');
    const isValidImage = (isPng || isJpeg) && !isSvgFallback;

    let contentParts: any[];

    if (isValidImage) {
      // Use image + text prompt
      const base64Data = imageUri.split(',')[1];
      const mimeType = isPng ? 'image/png' : 'image/jpeg';
      contentParts = [
        { inlineData: { mimeType, data: base64Data } },
        {
          text: `Based on this image and the presentation script below, create exactly 10 reading comprehension questions for a student at ${level} level.

Presentation Script:
"${script}"

RULES:
1. ${levelInstructions}
2. Questions should be about the image AND the script content.
3. Mix question types: factual recall (5), inference (3), vocabulary meaning (2).
4. Each question must have exactly one correct answer.
5. Explanations should be brief and educational (in Vietnamese for young learners).

Return JSON array with 10 objects, each having:
- question: string (the question in English)
- options: string[] (3-4 answer options in English)
- correctIndex: number (0-based index of correct answer)
- explanation: string (brief explanation in Vietnamese why this is correct)`
        }
      ];
    } else {
      // Use text-only prompt (fallback when image generation failed)
      console.warn('[Quiz Gen] Using text-only prompt (no valid image)');
      contentParts = [
        {
          text: `Based on the presentation script below, create exactly 10 reading comprehension questions for a student at ${level} level.

Presentation Script:
"${script}"

RULES:
1. ${levelInstructions}
2. Questions should be about the script content.
3. Mix question types: factual recall (5), inference (3), vocabulary meaning (2).
4. Each question must have exactly one correct answer.
5. Explanations should be brief and educational (in Vietnamese for young learners).

Return JSON array with 10 objects, each having:
- question: string (the question in English)
- options: string[] (3-4 answer options in English)
- correctIndex: number (0-based index of correct answer)
- explanation: string (brief explanation in Vietnamese why this is correct)`
        }
      ];
    }

    const response = await ai.models.generateContent({
      model: TEXT_MODEL_PRIMARY,
      contents: { parts: contentParts },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              options: { type: Type.ARRAY, items: { type: Type.STRING } },
              correctIndex: { type: Type.NUMBER },
              explanation: { type: Type.STRING }
            },
            required: ["question", "options", "correctIndex", "explanation"]
          }
        }
      }
    });

    const questions = JSON.parse(response.text || '[]');
    return questions.slice(0, 10);
  });
};
