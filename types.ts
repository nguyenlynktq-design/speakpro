
export type CEFRLevel = 'Starters' | 'Movers' | 'Flyers' | 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export interface Theme {
  id: string;
  label: string;
  icon: string;
  description: string;
}

export interface PresentationData {
  imageUri: string;
  script: string;
  points: string[];
  intro: string;
  conclusion: string;
  level: CEFRLevel;
}

export interface EvaluationResult {
  score: number; // Final average score
  pronunciation: number;
  fluency: number;
  intonation: number;
  vocabulary: number;
  grammar: number;
  taskFulfillment: number;
  perceivedLevel: string; // CEFR Mapping
  mistakes: { word: string; tip: string }[];
  feedback: string;
  teacherPraise: string;
  transcript: string;
  suggestions: string[];
}

export interface ComprehensionQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export enum AppStatus {
  IDLE = 'IDLE',
  GENERATING = 'GENERATING',
  READY = 'READY',
  RECORDING = 'RECORDING',
  REVIEWING = 'REVIEWING',
  EVALUATING = 'EVALUATING',
  RESULT = 'RESULT',
  ERROR = 'ERROR'
}
