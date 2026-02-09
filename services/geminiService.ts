
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
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      const errorStr = JSON.stringify(err).toLowerCase();
      const isQuotaError =
        err?.status === 429 ||
        err?.message?.includes('429') ||
        errorStr.includes('quota') ||
        errorStr.includes('resource_exhausted') ||
        errorStr.includes('rate_limit');

      if (isQuotaError && i < maxRetries - 1) {
        console.warn(`[Gemini API] Quota exceeded, retrying in ${delay}ms... (Attempt ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2.5; // Aggressive exponential backoff
        continue;
      }

      // If it's not a quota error or we're out of retries, throw the last error
      console.error("[Gemini API] Permanent Error:", err);
      throw err;
    }
  }
  throw new Error("MÁY CHỦ BẬN: Bé vui lòng chờ 30 giây rồi nhấn 'Thử lại' nhé!");
}

export const generateIllustration = async (theme: string): Promise<string> => {
  return callWithRetry(async () => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("Vui lòng nhập API Key để sử dụng app.");

    const ai = new GoogleGenAI({ apiKey });
    const prompt = `A highly vibrant, artistic, and detailed 3D Disney/Pixar style illustration for children showing: ${theme}. Soft lighting, friendly faces, bright colors. High quality.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: prompt }] },
      config: { imageConfig: { aspectRatio: "16:9" } }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
    throw new Error("Không tạo được ảnh minh họa.");
  });
};

export const generatePresentationScript = async (imageUri: string, theme: string, level: CEFRLevel): Promise<any> => {
  return callWithRetry(async () => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("Vui lòng nhập API Key để sử dụng app.");

    const ai = new GoogleGenAI({ apiKey });
    const base64Data = imageUri.split(',')[1];

    const levelInstructions = {
      'Starters': 'Create 5-6 very simple sentences. Focus on identifying objects and colors.',
      'Movers': 'Create 6-7 simple sentences. Use present continuous.',
      'Flyers': 'Create 7-8 sentences. Include feelings.',
      'A1': '8-10 sentences.',
      'A2': '10-12 sentences.',
      'B1': '12-15 sentences.',
      'B2': 'Sophisticated analysis.',
      'C1': 'Academic level detail.',
      'C2': 'Mastery level detail.'
    }[level] || '8-10 sentences.';

    const response = await ai.models.generateContent({
      model: TEXT_MODEL_PRIMARY,
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/png', data: base64Data } },
          {
            text: `Based on this picture for the topic "${theme}", write a pedagogical English presentation script for a student at ${level} level.
                   
                   STRICT RULES:
                   1. ${levelInstructions}
                   2. DO NOT use double periods.
                   3. Return JSON with: intro, points (array), conclusion.` }
        ]
      },
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
  return callWithRetry(async () => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("Vui lòng nhập API Key để sử dụng app.");

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Read slowly and clearly: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } }
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("Audio error");

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    const decodedData = await decodeAudioData(decode(base64Audio), audioContext, 24000, 1);
    return decodedData;
  });
};

export const evaluatePresentation = async (originalScript: string, transcript: string, level: CEFRLevel): Promise<EvaluationResult> => {
  return callWithRetry(async () => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("Vui lòng nhập API Key để sử dụng app.");

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: TEXT_MODEL_PRIMARY,
      contents: `Evaluate this child's English presentation.
                 Target Script: "${originalScript}"
                 Student Spoken Content: "${transcript}"
                 Expected Level: ${level}
                 
                 Evaluate based on these 6 criteria (Scale 0-10):
                 1. Pronunciation (Phát âm)
                 2. Fluency (Độ trôi chảy)
                 3. Intonation & Stress (Ngữ điệu & Trọng âm)
                 4. Vocabulary (Từ vựng)
                 5. Grammar (Ngữ pháp)
                 6. Task Fulfillment (Nói đúng nội dung & đủ yêu cầu)

                 Return JSON with:
                 - pronunciation, fluency, intonation, vocabulary, grammar, taskFulfillment (numbers 0-10)
                 - mistakes (array of {word, tip})
                 - feedback (in Vietnamese, friendly, child-focused, maximum 2 sentences)
                 - teacherPraise (in English, encouraging, short)
                 - suggestions (array of 2 specific English learning tips in Vietnamese)`,
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

    const base64Data = imageUri.split(',')[1];
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

    const response = await ai.models.generateContent({
      model: TEXT_MODEL_PRIMARY,
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/png', data: base64Data } },
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
        ]
      },
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
