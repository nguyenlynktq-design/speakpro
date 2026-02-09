
import React, { useState, useRef, useEffect } from 'react';
import { Theme, AppStatus, PresentationData, EvaluationResult, CEFRLevel } from './types';
import { PREDEFINED_THEMES, CEFR_LEVELS } from './constants';
import {
  generateIllustration,
  generatePresentationScript,
  generateTeacherVoice,
  evaluatePresentation,
  encode,
  getApiKey,
  saveApiConfig,
  initializeGeminiChat,
  getWordMeaning,
  speakWord
} from './services/geminiService';
import { saveLessonRecord } from './services/historyService';
import ThemeCard from './components/ThemeCard';
import ApiKeyModal from './components/ApiKeyModal';
import HistoryPanel from './components/HistoryPanel';
import Certificate from './components/Certificate';
import ComprehensionQuiz from './components/ComprehensionQuiz';
import { InteractiveText } from './components/VocabularyWord';
import {
  Mic, Play, Pause, RotateCcw, Sparkles, Wand2,
  Trophy, ArrowRight, MessageCircle, History, Award,
  ShieldCheck, StopCircle, Trash2, CheckCircle2, Clock, AlertTriangle, RefreshCw, Key
} from 'lucide-react';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';

const App: React.FC = () => {
  const [selectedTheme, setSelectedTheme] = useState<Theme | null>(null);
  const [customTheme, setCustomTheme] = useState('');
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<(() => Promise<void>) | null>(null);
  const [presentation, setPresentation] = useState<PresentationData | null>(null);
  const [childName, setChildName] = useState('Leo');
  const [level, setLevel] = useState<CEFRLevel>('Starters');
  const [transcript, setTranscript] = useState('');
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [audioState, setAudioState] = useState<'idle' | 'playing' | 'paused'>('idle');

  // API Key states
  const [showApiModal, setShowApiModal] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('gemini-3-flash-preview');

  // Check for API key on mount
  useEffect(() => {
    const storedKey = getApiKey();
    const storedModel = localStorage.getItem('gemini_selected_model') || 'gemini-3-flash-preview';
    if (storedKey) {
      setApiKey(storedKey);
      setSelectedModel(storedModel);
    } else {
      setShowApiModal(true);
    }
  }, []);

  const handleSaveApiKey = (key: string, model: string) => {
    saveApiConfig(key, model);
    setApiKey(key);
    setSelectedModel(model);
    setShowApiModal(false);

    // Per SKILL.md: If there was an error, clear it and reinitialize
    if (errorMessage) {
      setErrorMessage(null);
      initializeGeminiChat(key, model);
    }
  };

  // History panel state
  const [showHistory, setShowHistory] = useState(false);

  // Certificate state
  const [showCertificate, setShowCertificate] = useState(false);

  // Recording states
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [isReplayingRecorded, setIsReplayingRecorded] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const recordedAudioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const liveSessionRef = useRef<any>(null);
  const audioStartTimeRef = useRef<number>(0);
  const audioPausedAtRef = useRef<number>(0);
  const audioBufferRef = useRef<AudioBuffer | null>(null);

  const cleanPunctuation = (text: string) => {
    return text.replace(/\.+/g, '.').replace(/\s+/g, ' ').trim();
  };

  const handleError = (err: any, retryFn?: () => Promise<void>) => {
    console.error("App Error:", err);
    const errStr = JSON.stringify(err).toLowerCase();
    const msg = err?.message || "";

    if (msg.includes('429') || errStr.includes('quota') || errStr.includes('resource_exhausted')) {
      setErrorMessage("MÁY CHỦ BẬN: Ms Ly AI đang phục vụ quá nhiều bạn nhỏ. Bé chờ 30 giây rồi nhấn 'Thử lại' nhé!");
    } else {
      setErrorMessage(msg || "Ôi, có lỗi nhỏ rồi! Thử lại lần nữa nhé con.");
    }

    setLastAction(() => retryFn || null);
    setStatus(AppStatus.ERROR);
  };

  const handleGenerate = async () => {
    const themeText = customTheme || selectedTheme?.label;
    if (!themeText) return;
    try {
      setStatus(AppStatus.GENERATING);
      setErrorMessage(null);
      const img = await generateIllustration(themeText);
      const scriptData = await generatePresentationScript(img, themeText, level);
      const intro = cleanPunctuation(scriptData.intro.replace('[Name]', childName));
      const points = scriptData.points.map((p: string) => cleanPunctuation(p));
      const conclusion = cleanPunctuation(scriptData.conclusion);
      const fullScript = `${intro} ${points.join(' ')} ${conclusion}`;
      setPresentation({ imageUri: img, intro, points, conclusion, script: fullScript, level });
      setStatus(AppStatus.READY);
    } catch (err) {
      handleError(err, handleGenerate);
    }
  };

  const playTeacherVoice = async () => {
    if (!presentation || isAudioLoading) return;
    if (audioState === 'paused' && audioContextRef.current) {
      startAudioAt(audioPausedAtRef.current);
      setAudioState('playing');
      return;
    }
    if (audioState === 'playing') {
      if (sourceNodeRef.current) {
        sourceNodeRef.current.stop();
        audioPausedAtRef.current = audioContextRef.current!.currentTime - audioStartTimeRef.current;
        setAudioState('paused');
      }
      return;
    }
    try {
      setIsAudioLoading(true);
      if (!audioContextRef.current) audioContextRef.current = new AudioContext({ sampleRate: 24000 });
      const buffer = await generateTeacherVoice(presentation.script);
      audioBufferRef.current = buffer;
      startAudioAt(0);
      setAudioState('playing');
    } catch (err) {
      handleError(err, playTeacherVoice);
    } finally {
      setIsAudioLoading(false);
    }
  };

  const startAudioAt = (offset: number) => {
    if (!audioContextRef.current || !audioBufferRef.current) return;
    if (sourceNodeRef.current) sourceNodeRef.current.stop();
    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBufferRef.current;
    source.connect(audioContextRef.current.destination);
    source.onended = () => {
      const duration = audioBufferRef.current?.duration || 0;
      const currentPos = audioContextRef.current!.currentTime - audioStartTimeRef.current;
      if (currentPos >= duration - 0.1) {
        setAudioState('idle');
        audioPausedAtRef.current = 0;
      }
    };
    source.start(0, offset);
    audioStartTimeRef.current = audioContextRef.current.currentTime - offset;
    sourceNodeRef.current = source;
  };

  const stopAudio = () => {
    if (sourceNodeRef.current) {
      sourceNodeRef.current.stop();
      sourceNodeRef.current = null;
    }
    setAudioState('idle');
    audioPausedAtRef.current = 0;
  };

  const startRecording = async () => {
    setTranscript('');
    setRecordedBlob(null);
    setRecordingTime(0);
    audioChunksRef.current = [];
    stopAudio();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setStatus(AppStatus.RECORDING);

      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        setRecordedBlob(blob);
      };
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();

      timerIntervalRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      const ai = new GoogleGenAI({ apiKey });
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            const ctx = new AudioContext({ sampleRate: 16000 });
            const source = ctx.createMediaStreamSource(stream);
            const processor = ctx.createScriptProcessor(4096, 1, 1);
            processor.onaudioprocess = (e) => {
              const input = e.inputBuffer.getChannelData(0);
              const int16 = new Int16Array(input.length);
              for (let i = 0; i < input.length; i++) int16[i] = input[i] * 32768;
              sessionPromise.then((session) => {
                session.sendRealtimeInput({ media: { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' } });
              });
            };
            source.connect(processor);
            processor.connect(ctx.destination);
          },
          onmessage: (msg: LiveServerMessage) => {
            if (msg.serverContent?.inputTranscription) {
              setTranscript(prev => prev + msg.serverContent.inputTranscription.text + ' ');
            }
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          systemInstruction: 'You are an English speech-to-text engine. Transcribe exactly what you hear. Do not respond.'
        }
      });
      liveSessionRef.current = await sessionPromise;
    } catch (err) {
      handleError(err, startRecording);
    }
  };

  const stopRecording = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (liveSessionRef.current) {
      liveSessionRef.current.close();
      liveSessionRef.current = null;
    }
    setStatus(AppStatus.REVIEWING);
  };

  const playRecordedAudio = () => {
    if (!recordedBlob) return;
    if (isReplayingRecorded) {
      recordedAudioRef.current?.pause();
      setIsReplayingRecorded(false);
    } else {
      const url = URL.createObjectURL(recordedBlob);
      const audio = new Audio(url);
      recordedAudioRef.current = audio;
      audio.play();
      setIsReplayingRecorded(true);
      audio.onended = () => {
        setIsReplayingRecorded(false);
        URL.revokeObjectURL(url);
      };
    }
  };

  const handleSubmitEvaluation = async () => {
    if (!transcript.trim()) {
      setStatus(AppStatus.READY);
      return;
    }
    setStatus(AppStatus.EVALUATING);
    try {
      const evaluation = await evaluatePresentation(presentation!.script, transcript, level);
      setResult(evaluation);

      // Save lesson to history
      const themeText = presentation?.theme || customTheme || selectedTheme?.label || 'Unknown';
      saveLessonRecord(themeText, level, childName, evaluation, recordingTime);

      setStatus(AppStatus.RESULT);
    } catch (err) {
      handleError(err, handleSubmitEvaluation);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const reset = () => {
    setSelectedTheme(null);
    setCustomTheme('');
    setPresentation(null);
    setResult(null);
    setTranscript('');
    setRecordedBlob(null);
    setRecordingTime(0);
    setErrorMessage(null);
    setLastAction(null);
    setStatus(AppStatus.IDLE);
    stopAudio();
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
  };

  const handleRetry = async () => {
    if (lastAction) {
      setErrorMessage(null);
      await lastAction();
    } else {
      reset();
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-12 font-['Quicksand']">
      <header className="bg-white border-b-2 border-slate-100 sticky top-0 z-50 px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4 cursor-pointer group" onClick={reset}>
            <div className="bg-blue-600 p-2.5 rounded-xl shadow-lg shadow-blue-100 transform group-hover:rotate-6 transition-transform">
              <Sparkles className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-800 tracking-tight leading-none">Speakpro</h1>
              <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mt-1">Designed by Ms Ly AI</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-full border border-slate-100">
              <input type="text" value={childName} onChange={e => setChildName(e.target.value)} className="bg-transparent border-none outline-none font-bold text-slate-700 w-24 text-center" placeholder="Name" />
              <div className="w-px h-4 bg-slate-200" />
              <select value={level} onChange={e => setLevel(e.target.value as CEFRLevel)} className="bg-transparent font-bold text-blue-600 outline-none cursor-pointer text-sm">
                {CEFR_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            {/* History Button */}
            <button
              onClick={() => setShowHistory(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-slate-400 hover:text-purple-600 hover:bg-purple-50 transition-all"
              title="Lịch sử học tập"
            >
              <History size={18} />
            </button>
            {/* Settings Button - Always visible */}
            <button
              onClick={() => setShowApiModal(true)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all ${apiKey ? 'text-slate-400 hover:text-blue-600 hover:bg-blue-50' : 'bg-red-50 text-red-500 animate-pulse'
                }`}
              title="Cài đặt API Key"
            >
              <Key size={18} />
              {!apiKey && <span className="text-xs font-bold hidden sm:inline">Lấy API key để sử dụng app</span>}
            </button>
            {presentation && (
              <button onClick={reset} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                <RotateCcw size={20} />
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 mt-10">
        {status === AppStatus.IDLE && (
          <div className="space-y-16 animate-in fade-in slide-in-from-bottom-10 duration-700">
            <div className="text-center max-w-4xl mx-auto space-y-6">
              <h2 className="text-5xl font-black text-slate-900 leading-tight">Luyện nói tiếng Anh chuẩn cùng Ms Ly AI</h2>
              <p className="text-slate-500 text-lg font-medium">Chọn một chủ đề để bắt đầu thuyết trình!</p>
              <div className="relative group max-w-2xl mx-auto pt-4">
                <input type="text" placeholder="Hoặc nhập chủ đề bé muốn (vd: My Superpowers)..." className="w-full px-8 py-5 rounded-2xl border-2 border-slate-100 focus:border-blue-400 outline-none shadow-xl shadow-slate-200/50 text-xl transition-all pr-16 bg-white font-bold" value={customTheme} onChange={(e) => { setCustomTheme(e.target.value); setSelectedTheme(null); }} />
                <div className="absolute right-4 top-[calc(50%+8px)] -translate-y-1/2 text-slate-300"><Wand2 size={24} /></div>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
              {PREDEFINED_THEMES.map((t) => <ThemeCard key={t.id} theme={t} isSelected={selectedTheme?.id === t.id} onClick={(theme) => { setSelectedTheme(theme); setCustomTheme(''); }} />)}
            </div>
            <div className="flex flex-col items-center pb-20">
              <button disabled={!selectedTheme && !customTheme} onClick={handleGenerate} className="group flex items-center gap-4 px-12 py-5 rounded-2xl font-black text-xl shadow-xl shadow-blue-200 transition-all hover:scale-105 active:scale-95 bg-blue-600 text-white disabled:opacity-20">
                Tạo bài học mới <ArrowRight size={24} className="group-hover:translate-x-2 transition-transform" />
              </button>
            </div>
          </div>
        )}

        {status === AppStatus.GENERATING && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8">
            <div className="w-24 h-24 bg-blue-50 rounded-3xl flex items-center justify-center animate-bounce"><Sparkles size={48} className="text-blue-600" /></div>
            <div className="text-center">
              <h3 className="text-3xl font-black text-slate-800">Ms Ly AI đang soạn bài...</h3>
              <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mt-2">Đang vẽ tranh và viết kịch bản</p>
            </div>
          </div>
        )}

        {status === AppStatus.ERROR && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 animate-in zoom-in-90">
            <div className="bg-red-50 p-6 rounded-3xl text-red-500 shadow-xl shadow-red-50">
              {errorMessage?.includes('MÁY CHỦ') ? <AlertTriangle size={64} /> : <RotateCcw size={64} />}
            </div>
            <div className="text-center max-w-md px-6">
              <h3 className="text-2xl font-black text-slate-800 mb-4 whitespace-pre-line leading-relaxed">
                {errorMessage || "Ôi, có lỗi rồi!\nThử lại lần nữa nhé con."}
              </h3>
            </div>
            <div className="flex gap-4 flex-wrap justify-center">
              <button
                onClick={() => setShowApiModal(true)}
                className="flex items-center gap-3 px-8 py-4 bg-amber-500 text-white font-black text-lg rounded-2xl shadow-xl hover:bg-amber-600 transition-all active:scale-95"
              >
                <Key size={20} /> Đổi API Key
              </button>
              <button onClick={handleRetry} className="flex items-center gap-3 px-10 py-4 bg-blue-600 text-white font-black text-lg rounded-2xl shadow-xl hover:bg-blue-700 transition-all active:scale-95">
                <RefreshCw size={20} /> Thử lại
              </button>
              <button onClick={reset} className="px-10 py-4 bg-slate-100 text-slate-600 font-black text-lg rounded-2xl hover:bg-slate-200 transition-all">
                Về trang chủ
              </button>
            </div>
          </div>
        )}

        {(status === AppStatus.READY || status === AppStatus.RECORDING || status === AppStatus.REVIEWING) && presentation && (
          <div className="animate-in fade-in slide-in-from-bottom-5 duration-500 pb-20">
            <div className="max-w-6xl mx-auto bg-white rounded-[2.5rem] shadow-2xl border-2 border-slate-100 overflow-hidden flex flex-col lg:flex-row relative">
              <div className={`lg:w-1/2 p-6 flex flex-col gap-6 transition-all duration-500 ${status === AppStatus.RECORDING ? 'opacity-30 scale-95 grayscale' : ''}`}>
                <div className="bg-slate-50 rounded-[2rem] p-2 border-2 border-slate-100 overflow-hidden shadow-inner">
                  <img src={presentation.imageUri} className="w-full h-auto rounded-[1.5rem]" alt="Illustration" />
                </div>
                <div className="bg-blue-50/50 border-2 border-blue-100 rounded-3xl p-5 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <button onClick={playTeacherVoice} disabled={isAudioLoading} className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all">
                      {isAudioLoading ? <div className="w-5 h-5 border-3 border-white border-t-transparent animate-spin rounded-full"></div> : audioState === 'playing' ? <Pause size={24} /> : <Play size={24} className="ml-1" />}
                    </button>
                    <div>
                      <p className="text-xs font-black text-blue-600 uppercase">Mẫu từ Ms Ly</p>
                      <p className="text-sm font-bold text-slate-500">{audioState === 'playing' ? 'Đang đọc...' : 'Nghe để luyện'}</p>
                    </div>
                  </div>
                  {audioState !== 'idle' && <button onClick={stopAudio} className="p-2 text-slate-400 hover:text-red-500 transition-colors"><StopCircle size={24} /></button>}
                </div>
              </div>

              <div className={`lg:w-1/2 p-10 lg:p-14 bg-[#fffdfa] relative flex flex-col transition-all duration-300 ${status === AppStatus.RECORDING ? 'bg-red-50/10' : ''}`}>
                <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#3b82f6 1.5px, transparent 1.5px)', backgroundSize: '24px 24px' }}></div>
                <div className="relative z-10 flex flex-col h-full">
                  <div className="flex items-center justify-between mb-8 border-b-2 border-dashed border-slate-200 pb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-white rounded-full p-0.5 shadow-md border-2 border-blue-400 overflow-hidden"><img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${childName}`} alt="avatar" /></div>
                      <div>
                        <h3 className="text-2xl font-black text-slate-800">Hello, I'm {childName}!</h3>
                        <p className="text-xs font-bold text-blue-500 uppercase tracking-widest">{presentation.level} Level</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 space-y-8">
                    <div>
                      <h4 className="text-blue-600 font-black text-lg mb-2 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span> Introduction
                      </h4>
                      <p className="text-2xl font-bold text-slate-800 leading-snug pl-4 italic">
                        "<InteractiveText
                          text={presentation.intro}
                          onGetMeaning={getWordMeaning}
                          onSpeak={speakWord}
                        />"
                      </p>
                    </div>
                    <div>
                      <h4 className="text-green-600 font-black text-lg mb-4 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span> Description
                      </h4>
                      <ul className="space-y-4 pl-4">
                        {presentation.points.map((p, i) => (
                          <li key={i} className="flex items-start gap-4 group">
                            <span className="w-3 h-3 rounded-full mt-2.5 shrink-0 bg-blue-400"></span>
                            <span className="text-2xl font-bold text-slate-700 leading-snug">
                              <InteractiveText
                                text={p}
                                onGetMeaning={getWordMeaning}
                                onSpeak={speakWord}
                              />
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-pink-600 font-black text-lg mb-2 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-pink-500"></span> Conclusion
                      </h4>
                      <p className="text-2xl font-bold text-slate-800 leading-snug pl-4 italic">
                        "<InteractiveText
                          text={presentation.conclusion}
                          onGetMeaning={getWordMeaning}
                          onSpeak={speakWord}
                        />"
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Comprehension Quiz */}
            <ComprehensionQuiz
              imageUri={presentation.imageUri}
              script={presentation.script}
              level={level}
              theme={presentation?.theme || customTheme || selectedTheme?.label || ''}
            />

            <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] w-full max-w-2xl px-6">
              {status === AppStatus.READY && (
                <button onClick={startRecording} className="w-full bg-blue-600 text-white px-8 py-6 rounded-3xl font-black text-2xl flex items-center justify-center gap-4 hover:bg-blue-700 shadow-2xl transition-all transform hover:-translate-y-2 group">
                  <div className="bg-white/20 p-2 rounded-xl group-hover:scale-110 transition-transform"><Mic size={28} /></div>
                  Bắt đầu nói
                </button>
              )}
              {status === AppStatus.RECORDING && (
                <div className="flex flex-col gap-4">
                  <div className="bg-white/95 backdrop-blur-md border-2 border-red-100 p-5 rounded-3xl shadow-2xl flex items-center justify-between animate-in slide-in-from-bottom-5">
                    <div className="flex items-center gap-4">
                      <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]"></div>
                      <p className="text-lg font-black text-slate-800 uppercase tracking-tight">Đang thu âm...</p>
                    </div>
                    <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100 font-black text-blue-600">
                      <Clock size={18} />
                      {formatTime(recordingTime)}
                    </div>
                  </div>
                  <button onClick={stopRecording} className="w-full bg-red-600 text-white px-8 py-6 rounded-3xl font-black text-2xl flex items-center justify-center gap-4 shadow-2xl transition-all active:scale-95">
                    <StopCircle size={28} /> Dừng và Nộp bài
                  </button>
                </div>
              )}
              {status === AppStatus.REVIEWING && (
                <div className="flex flex-col gap-4 animate-in slide-in-from-bottom-5">
                  <div className="bg-white/95 backdrop-blur-md border-2 border-blue-50 p-5 rounded-3xl shadow-2xl">
                    <div className="text-center mb-4">
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Bản thu âm của con</p>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <button onClick={playRecordedAudio} className={`flex flex-col items-center gap-2 p-5 rounded-2xl transition-all ${isReplayingRecorded ? 'bg-blue-100 text-blue-700' : 'bg-slate-50 hover:bg-slate-100'}`}>
                        {isReplayingRecorded ? <Pause size={24} /> : <Play size={24} />}
                        <span className="text-[10px] font-black uppercase">Nghe lại</span>
                      </button>
                      <button onClick={startRecording} className="flex flex-col items-center gap-2 p-5 rounded-2xl bg-slate-50 hover:bg-red-50 hover:text-red-500 transition-all">
                        <Trash2 size={24} />
                        <span className="text-[10px] font-black uppercase">Thu lại</span>
                      </button>
                      <button onClick={handleSubmitEvaluation} className="flex flex-col items-center gap-2 p-5 rounded-2xl bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-lg active:scale-95">
                        <CheckCircle2 size={24} />
                        <span className="text-[10px] font-black uppercase">Chấm điểm</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {status === AppStatus.EVALUATING && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8 animate-in fade-in">
            <div className="relative">
              <div className="w-24 h-24 border-[8px] border-blue-50 border-t-blue-600 rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center"><ShieldCheck className="text-blue-100" size={32} /></div>
            </div>
            <div className="text-center">
              <h3 className="text-3xl font-black text-slate-800">Ms Ly đang chấm bài...</h3>
              <p className="text-slate-400 font-bold uppercase tracking-widest mt-2">Đang phân tích kĩ năng của con</p>
            </div>
          </div>
        )}

        {status === AppStatus.RESULT && result && (
          <div className="max-w-5xl mx-auto animate-in zoom-in-95 duration-700 pb-20">
            <div className="bg-white rounded-[3rem] shadow-2xl overflow-hidden border border-slate-100">
              <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-12 lg:p-16 text-center text-white relative">
                <div className="absolute top-8 right-8 bg-white/10 px-6 py-2 rounded-full font-black text-xs backdrop-blur-md border border-white/10 uppercase tracking-widest">Level: {result.perceivedLevel}</div>
                <div className="relative inline-block mb-8">
                  <Trophy size={100} className="mx-auto text-yellow-300 drop-shadow-2xl animate-bounce" />
                  <div className="absolute -bottom-2 -right-2 bg-white text-blue-700 w-16 h-16 rounded-2xl flex flex-col items-center justify-center font-black shadow-xl rotate-6">
                    <span className="text-2xl leading-none">{result.score}</span>
                    <span className="text-[8px] uppercase">/10</span>
                  </div>
                </div>
                <h2 className="text-5xl font-black mb-4 tracking-tight uppercase">{result.score >= 8 ? 'Excellent!' : 'Good Job!'}</h2>
                <p className="text-xl font-bold italic text-blue-100 max-w-2xl mx-auto opacity-90">"{result.teacherPraise}"</p>
              </div>
              <div className="p-8 lg:p-16 grid md:grid-cols-2 gap-12 lg:gap-16">
                <div className="space-y-8">
                  <h4 className="text-2xl font-black text-slate-800 flex items-center gap-3"><MessageCircle className="text-blue-500" size={28} /> Cô Ly Nhận Xét</h4>
                  <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100 shadow-inner">
                    <p className="text-lg text-slate-600 leading-relaxed font-bold italic">"{result.feedback}"</p>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 flex flex-col justify-center">
                      <p className="text-xl font-black text-blue-600">{result.pronunciation}</p>
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Pronunciation</p>
                    </div>
                    <div className="p-4 bg-pink-50 rounded-2xl border border-pink-100 flex flex-col justify-center">
                      <p className="text-xl font-black text-pink-600">{result.fluency}</p>
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Fluency</p>
                    </div>
                    <div className="p-4 bg-orange-50 rounded-2xl border border-orange-100 flex flex-col justify-center">
                      <p className="text-xl font-black text-orange-600">{result.intonation}</p>
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Intonation</p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-2xl border border-green-100 flex flex-col justify-center">
                      <p className="text-xl font-black text-green-600">{result.vocabulary}</p>
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Vocabulary</p>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-2xl border border-purple-100 flex flex-col justify-center">
                      <p className="text-xl font-black text-purple-600">{result.grammar}</p>
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Grammar</p>
                    </div>
                    <div className="p-4 bg-teal-50 rounded-2xl border border-teal-100 flex flex-col justify-center">
                      <p className="text-xl font-black text-teal-600">{result.taskFulfillment}</p>
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Task</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-8">
                  <h4 className="text-2xl font-black text-slate-800 flex items-center gap-3"><Sparkles className="text-yellow-500" size={28} /> Gợi ý cải thiện</h4>
                  <div className="space-y-4">
                    {result.suggestions?.map((s, i) => (
                      <div key={i} className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm flex items-start gap-4 hover:border-blue-200 transition-all">
                        <div className="bg-blue-50 p-2 rounded-xl text-blue-600 font-black text-xs shrink-0">{i + 1}</div>
                        <p className="text-md font-bold text-slate-700">{s}</p>
                      </div>
                    ))}
                    {result.mistakes.map((m, i) => (
                      <div key={`m-${i}`} className="bg-red-50/50 border border-red-100 p-5 rounded-2xl shadow-sm flex items-start gap-4">
                        <div className="bg-red-100 p-2 rounded-xl text-red-600 font-black text-xs shrink-0">!</div>
                        <div>
                          <p className="text-lg font-black text-slate-800">{m.word}</p>
                          <p className="text-sm font-bold text-slate-400">{m.tip}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="p-16 pt-0 flex flex-col sm:flex-row justify-center gap-6 flex-wrap">
                <button onClick={() => setStatus(AppStatus.READY)} className="px-10 py-5 rounded-2xl font-black text-lg text-slate-400 bg-slate-50 hover:bg-slate-100 transition-all flex items-center justify-center gap-3">
                  <RotateCcw size={20} /> Luyện lại
                </button>
                <button
                  onClick={() => setShowCertificate(true)}
                  className="px-10 py-5 rounded-2xl font-black text-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 shadow-xl shadow-amber-100 transition-all flex items-center justify-center gap-3"
                >
                  <Award size={20} /> Nhận Chứng Nhận
                </button>
                <button onClick={reset} className="px-12 py-5 rounded-2xl font-black text-lg bg-blue-600 text-white hover:bg-blue-700 shadow-xl shadow-blue-100 transition-all flex items-center justify-center gap-3">
                  Bài học mới <ArrowRight size={20} />
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
      <footer className="max-w-7xl mx-auto px-6 mt-20 text-center pb-12">
        <p className="text-slate-300 text-[10px] font-bold uppercase tracking-[0.2em]">Speakpro được thiết kế bởi Ms Ly AI</p>
      </footer>

      {/* API Key Modal */}
      <ApiKeyModal
        isOpen={showApiModal}
        onClose={() => setShowApiModal(false)}
        onSave={handleSaveApiKey}
        initialApiKey={apiKey}
        initialModel={selectedModel}
      />

      {/* History Panel */}
      <HistoryPanel
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
      />

      {/* Certificate */}
      {result && (
        <Certificate
          isOpen={showCertificate}
          onClose={() => setShowCertificate(false)}
          childName={childName}
          theme={presentation?.theme || customTheme || selectedTheme?.label || ''}
          level={level}
          evaluation={result}
        />
      )}
    </div>
  );
};

export default App;
