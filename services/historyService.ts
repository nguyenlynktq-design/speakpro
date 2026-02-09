import { EvaluationResult, CEFRLevel } from '../types';

export interface LessonRecord {
    id: string;
    date: string; // ISO string
    theme: string;
    level: CEFRLevel;
    childName: string;
    score: number;
    pronunciation: number;
    fluency: number;
    intonation: number;
    vocabulary: number;
    grammar: number;
    taskFulfillment: number;
    perceivedLevel: string;
    duration: number; // in seconds
}

const STORAGE_KEY = 'speakpro_lesson_history';
const EXPIRY_DAYS = 7;

/**
 * Get all lesson history from localStorage
 */
export function getLessonHistory(): LessonRecord[] {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (!data) return [];

        const records: LessonRecord[] = JSON.parse(data);

        // Filter out expired records (older than 7 days)
        const now = new Date();
        const validRecords = records.filter(record => {
            const recordDate = new Date(record.date);
            const diffDays = (now.getTime() - recordDate.getTime()) / (1000 * 60 * 60 * 24);
            return diffDays <= EXPIRY_DAYS;
        });

        // Save back if we filtered some records
        if (validRecords.length !== records.length) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(validRecords));
        }

        return validRecords;
    } catch {
        return [];
    }
}

/**
 * Save a new lesson record
 */
export function saveLessonRecord(
    theme: string,
    level: CEFRLevel,
    childName: string,
    evaluation: EvaluationResult,
    duration: number
): LessonRecord {
    const record: LessonRecord = {
        id: `lesson_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        date: new Date().toISOString(),
        theme,
        level,
        childName,
        score: evaluation.score,
        pronunciation: evaluation.pronunciation,
        fluency: evaluation.fluency,
        intonation: evaluation.intonation,
        vocabulary: evaluation.vocabulary,
        grammar: evaluation.grammar,
        taskFulfillment: evaluation.taskFulfillment,
        perceivedLevel: evaluation.perceivedLevel,
        duration
    };

    const history = getLessonHistory();
    history.push(record);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));

    return record;
}

/**
 * Get lessons grouped by day for the last 7 days
 */
export function getLessonsGroupedByDay(): { date: string; lessons: LessonRecord[]; avgScore: number }[] {
    const history = getLessonHistory();
    const grouped = new Map<string, LessonRecord[]>();

    // Create entries for last 7 days
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateKey = date.toISOString().split('T')[0];
        grouped.set(dateKey, []);
    }

    // Populate with actual data
    history.forEach(lesson => {
        const dateKey = lesson.date.split('T')[0];
        if (grouped.has(dateKey)) {
            grouped.get(dateKey)!.push(lesson);
        }
    });

    return Array.from(grouped.entries()).map(([date, lessons]) => ({
        date,
        lessons,
        avgScore: lessons.length > 0
            ? Math.round(lessons.reduce((sum, l) => sum + l.score, 0) / lessons.length * 10) / 10
            : 0
    }));
}

/**
 * Get average scores for each skill over the week
 */
export function getWeeklySkillAverages(): {
    pronunciation: number;
    fluency: number;
    intonation: number;
    vocabulary: number;
    grammar: number;
    taskFulfillment: number;
    totalLessons: number;
    totalTime: number;
} {
    const history = getLessonHistory();

    if (history.length === 0) {
        return {
            pronunciation: 0,
            fluency: 0,
            intonation: 0,
            vocabulary: 0,
            grammar: 0,
            taskFulfillment: 0,
            totalLessons: 0,
            totalTime: 0
        };
    }

    const sum = history.reduce((acc, lesson) => ({
        pronunciation: acc.pronunciation + lesson.pronunciation,
        fluency: acc.fluency + lesson.fluency,
        intonation: acc.intonation + lesson.intonation,
        vocabulary: acc.vocabulary + lesson.vocabulary,
        grammar: acc.grammar + lesson.grammar,
        taskFulfillment: acc.taskFulfillment + lesson.taskFulfillment,
        totalTime: acc.totalTime + lesson.duration
    }), {
        pronunciation: 0, fluency: 0, intonation: 0,
        vocabulary: 0, grammar: 0, taskFulfillment: 0, totalTime: 0
    });

    const count = history.length;
    return {
        pronunciation: Math.round(sum.pronunciation / count * 10) / 10,
        fluency: Math.round(sum.fluency / count * 10) / 10,
        intonation: Math.round(sum.intonation / count * 10) / 10,
        vocabulary: Math.round(sum.vocabulary / count * 10) / 10,
        grammar: Math.round(sum.grammar / count * 10) / 10,
        taskFulfillment: Math.round(sum.taskFulfillment / count * 10) / 10,
        totalLessons: count,
        totalTime: sum.totalTime
    };
}

/**
 * Get recent lessons (last 5)
 */
export function getRecentLessons(limit: number = 5): LessonRecord[] {
    const history = getLessonHistory();
    return history.slice(-limit).reverse();
}

/**
 * Get daily streak (consecutive days with at least 1 lesson)
 */
export function getDailyStreak(): number {
    const grouped = getLessonsGroupedByDay();
    let streak = 0;

    // Start from today and go backwards
    for (let i = grouped.length - 1; i >= 0; i--) {
        if (grouped[i].lessons.length > 0) {
            streak++;
        } else if (i === grouped.length - 1) {
            // If today has no lessons, check if yesterday had lessons
            continue;
        } else {
            break;
        }
    }

    return streak;
}

/**
 * Delete a specific lesson
 */
export function deleteLessonRecord(id: string): void {
    const history = getLessonHistory().filter(l => l.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

/**
 * Clear all history
 */
export function clearHistory(): void {
    localStorage.removeItem(STORAGE_KEY);
}

/**
 * Format duration in mm:ss
 */
export function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Get day of week name in Vietnamese
 */
export function getVietnameseDayName(dateStr: string): string {
    const date = new Date(dateStr);
    const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    return days[date.getDay()];
}
