import React, { useRef } from 'react';
import { Award, Download, Printer, Star, CheckCircle2 } from 'lucide-react';
import { EvaluationResult } from '../types';

interface CertificateProps {
    isOpen: boolean;
    onClose: () => void;
    childName: string;
    theme: string;
    level: string;
    evaluation: EvaluationResult;
    teacherName?: string;
    centerName?: string;
}

// Get grade classification based on score (scale 0-10)
const getGradeInfo = (score: number): { grade: string; color: string; stars: number } => {
    if (score >= 9) return { grade: 'Xuất sắc', color: 'text-amber-500', stars: 5 };
    if (score >= 8) return { grade: 'Giỏi', color: 'text-emerald-500', stars: 4 };
    if (score >= 7) return { grade: 'Khá', color: 'text-blue-500', stars: 3 };
    if (score >= 5) return { grade: 'Trung bình', color: 'text-orange-500', stars: 2 };
    return { grade: 'Cần cố gắng', color: 'text-slate-500', stars: 1 };
};

// Format date in Vietnamese
const formatDateVN = (date: Date): string => {
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    return `Ngày ${day} tháng ${month} năm ${year}`;
};

const Certificate: React.FC<CertificateProps> = ({
    isOpen,
    onClose,
    childName,
    theme,
    level,
    evaluation,
    teacherName = "Ms Ly AI",
    centerName = "SpeakPro English Academy"
}) => {
    const certificateRef = useRef<HTMLDivElement>(null);
    const gradeInfo = getGradeInfo(evaluation.score);

    const handlePrint = () => {
        const printContent = certificateRef.current;
        if (!printContent) return;

        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Giấy Chứng Nhận - ${childName}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Quicksand:wght@400;500;600;700&display=swap');
          @import url('https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap');
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Quicksand', sans-serif; }
          @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        </style>
      </head>
      <body>${printContent.innerHTML}</body>
      </html>
    `);
        printWindow.document.close();
        setTimeout(() => printWindow.print(), 500);
    };

    const handleDownload = async () => {
        const certificate = certificateRef.current;
        if (!certificate) return;

        try {
            // Use html2canvas if available, otherwise fallback to print
            if ((window as any).html2canvas) {
                const canvas = await (window as any).html2canvas(certificate, {
                    scale: 2,
                    useCORS: true,
                    backgroundColor: '#ffffff'
                });
                const link = document.createElement('a');
                link.download = `certificate_${childName}_${Date.now()}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
            } else {
                handlePrint();
            }
        } catch {
            handlePrint();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[95vh] overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Award className="text-white" size={28} />
                        <span className="text-xl font-black text-white">Giấy Chứng Nhận</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleDownload}
                            className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-white font-bold text-sm transition-all"
                        >
                            <Download size={16} /> Tải ảnh
                        </button>
                        <button
                            onClick={handlePrint}
                            className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-white font-bold text-sm transition-all"
                        >
                            <Printer size={16} /> In
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 bg-white/20 hover:bg-white/30 rounded-xl text-white transition-all ml-2"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* Certificate Content */}
                <div className="p-6 overflow-y-auto max-h-[calc(95vh-80px)]">
                    <div
                        ref={certificateRef}
                        className="relative bg-gradient-to-br from-pink-50 via-yellow-50 to-cyan-50 rounded-3xl p-8 shadow-2xl"
                        style={{
                            minHeight: '500px',
                            border: '10px solid transparent',
                            backgroundImage: 'linear-gradient(white, white), linear-gradient(135deg, #f472b6, #fb923c, #facc15, #4ade80, #60a5fa, #a78bfa)',
                            backgroundOrigin: 'padding-box, border-box',
                            backgroundClip: 'padding-box, border-box'
                        }}
                    >
                        {/* Corner star decorations */}
                        <div className="absolute top-6 left-6 text-3xl animate-pulse">⭐</div>
                        <div className="absolute top-6 right-6 text-3xl animate-pulse" style={{ animationDelay: '0.3s' }}>🌟</div>
                        <div className="absolute bottom-6 left-6 text-3xl animate-pulse" style={{ animationDelay: '0.6s' }}>✨</div>
                        <div className="absolute bottom-6 right-6 text-3xl animate-pulse" style={{ animationDelay: '0.9s' }}>🎉</div>

                        {/* Confetti decorations */}
                        <div className="absolute top-12 left-1/4 text-2xl opacity-60">🎊</div>
                        <div className="absolute top-12 right-1/4 text-2xl opacity-60">🎊</div>

                        {/* Content */}
                        <div className="text-center space-y-6 relative z-10">
                            {/* Header */}
                            <div className="space-y-2">
                                <p className="text-sm font-bold text-amber-600 uppercase tracking-[0.3em]">{centerName}</p>
                                <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-600 to-orange-500 uppercase tracking-wider">
                                    Giấy Chứng Nhận
                                </h1>
                                <p className="text-lg text-slate-500 font-semibold">Certificate of Achievement</p>
                            </div>

                            {/* Divider */}
                            <div className="flex items-center justify-center gap-4">
                                <div className="h-px bg-gradient-to-r from-transparent to-amber-300 w-24"></div>
                                <Award className="text-amber-500" size={32} />
                                <div className="h-px bg-gradient-to-l from-transparent to-amber-300 w-24"></div>
                            </div>

                            {/* Student Name */}
                            <div className="py-4">
                                <p className="text-slate-600 font-medium mb-2">Chứng nhận học sinh</p>
                                <h2
                                    className="text-5xl font-black text-slate-800"
                                    style={{ fontFamily: "'Great Vibes', cursive" }}
                                >
                                    {childName}
                                </h2>
                            </div>

                            {/* Achievement */}
                            <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-amber-100 max-w-lg mx-auto">
                                <p className="text-slate-600 font-medium mb-3">
                                    Đã hoàn thành xuất sắc bài thuyết trình tiếng Anh
                                </p>
                                <p className="text-2xl font-black text-slate-800 mb-2">"{theme}"</p>
                                <div className="flex items-center justify-center gap-2 text-sm text-slate-500 font-bold">
                                    <CheckCircle2 size={16} className="text-green-500" />
                                    Trình độ: {level}
                                </div>
                            </div>

                            {/* Score Section */}
                            <div className="flex items-center justify-center gap-8 py-4">
                                <div className="text-center">
                                    <div className={`text-6xl font-black ${gradeInfo.color}`}>
                                        {evaluation.score.toFixed(1)}
                                    </div>
                                    <p className="text-sm font-bold text-slate-500 mt-1">ĐIỂM TRUNG BÌNH</p>
                                </div>
                                <div className="h-16 w-px bg-amber-200"></div>
                                <div className="text-center">
                                    <div className={`text-3xl font-black ${gradeInfo.color} mb-2`}>
                                        {gradeInfo.grade}
                                    </div>
                                    <div className="flex items-center gap-1 justify-center">
                                        {[...Array(5)].map((_, i) => (
                                            <Star
                                                key={i}
                                                size={20}
                                                className={i < gradeInfo.stars ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Skills Summary */}
                            <div className="grid grid-cols-3 gap-3 max-w-md mx-auto text-sm">
                                {[
                                    { label: 'Phát âm', value: evaluation.pronunciation },
                                    { label: 'Lưu loát', value: evaluation.fluency },
                                    { label: 'Ngữ điệu', value: evaluation.intonation },
                                    { label: 'Từ vựng', value: evaluation.vocabulary },
                                    { label: 'Ngữ pháp', value: evaluation.grammar },
                                    { label: 'Hoàn thành', value: evaluation.taskFulfillment },
                                ].map(skill => (
                                    <div key={skill.label} className="bg-white/80 rounded-lg px-3 py-2 border border-amber-100">
                                        <span className="text-slate-500 font-medium">{skill.label}: </span>
                                        <span className="font-black text-slate-700">{skill.value}/10</span>
                                    </div>
                                ))}
                            </div>

                            {/* Footer */}
                            <div className="pt-6 border-t border-amber-100 mt-6">
                                <div className="flex items-start justify-between max-w-md mx-auto">
                                    <div className="text-center">
                                        <p className="text-xs text-slate-400 mb-2">{formatDateVN(new Date())}</p>
                                        <div className="w-32 h-px bg-slate-300 mb-2"></div>
                                        <p className="text-sm font-bold text-slate-600">Ngày cấp</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-lg font-bold text-slate-700 mb-1" style={{ fontFamily: "'Great Vibes', cursive" }}>
                                            {teacherName}
                                        </p>
                                        <div className="w-32 h-px bg-slate-300 mb-2"></div>
                                        <p className="text-sm font-bold text-slate-600">Giáo viên</p>
                                    </div>
                                </div>
                            </div>

                            {/* SpeakPro Logo */}
                            <div className="pt-4">
                                <p className="text-[10px] text-slate-300 uppercase tracking-[0.2em]">
                                    Powered by SpeakPro • Designed by Ms Ly AI
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Certificate;
