import {
    createSignal,
    onCleanup,
    onMount,
    Component,
    Show,
    For,
    createEffect,
    Accessor
} from 'solid-js';
import { PitchDetectionService } from '../libs/pitch-detection/pitchDetectionService';
import PianoRoll from '../components/PianoRoll';
import ControlBar from '../components/demo/ControlBar';
import {
    getNoteDetails,
} from '../utils/midiUtils';
import type { NoteDetails } from '../utils/midiUtils';

const CHART_DURATION_SECONDS = 20;

const VIEW_DURATION_SECONDS = 20;

export interface MidiSegment {
    startTime: number; // timestamp ms (represents adjusted time)
    endTime: number;   // timestamp ms (represents adjusted time)
    duration: number;  // ms
    avgContinuousMidi: number | null;
    avgConfidence: number;
}

interface PitchHistoryPoint {
    x: number; // timestamp ms (represents adjusted time)
    y: number | null;
    confidence: number;
    continuousMidi: number | null;
}

const Demo: Component = () => {
    // --- State Signals ---
    const [pitch, setPitch] = createSignal<number | null>(null);
    const [confidence, setConfidence] = createSignal<number>(0);
    const [noteDetails, setNoteDetails] = createSignal<NoteDetails | null>(null);
    const [isProcessing, setIsProcessing] = createSignal<boolean>(false);
    const [error, setError] = createSignal<string | null>(null);
    const [isInitializing, setIsInitializing] = createSignal<boolean>(false);
    const [isServiceReady, setIsServiceReady] = createSignal<boolean>(false);
    const [pitchHistory, setPitchHistory] = createSignal<PitchHistoryPoint[]>([]);
    const [fullPitchHistory, setFullPitchHistory] = createSignal<PitchHistoryPoint[]>([]);
    const [segmentedNotes, setSegmentedNotes] = createSignal<MidiSegment[]>([]);
    // Set initial view window based on current time
    const initialNow = Date.now(); // Capture initial time
    const [viewStartTime, setViewStartTime] = createSignal(initialNow - VIEW_DURATION_SECONDS * 1000);
    const [viewEndTime, setViewEndTime] = createSignal(initialNow);
    const [startAfterInit, setStartAfterInit] = createSignal(false);

    // State for tracking pause time
    const [pauseOffset, setPauseOffset] = createSignal(0);
    const [pauseStartTime, setPauseStartTime] = createSignal(0); // Timestamp when pause started

    let serviceInstance: PitchDetectionService | null = null;

    // --- Constants for Segmentation ---
    const CONFIDENCE_THRESHOLD = 0.65;
    const PITCH_CHANGE_THRESHOLD_SEMITONES = 0.75;
    const MIN_NOTE_DURATION_MS = 80;
    const MAX_GAP_MS_FOR_MERGE = 100;
    const PITCH_DIFF_FOR_MERGE_SEMITONES = 0.5;

    // Helper to get adjusted time (now - total accumulated pause duration)
    const getAdjustedNow = () => Date.now() - pauseOffset();

    const generateMidiSegments = (history: PitchHistoryPoint[]) => {
        // This function uses the timestamps already present in history, which are adjusted
        if (!history || history.length < 2) {
            // Keep existing segments if history is too short after a potential clear
            // setSegmentedNotes([]); // Don't clear here necessarily
            return;
        }

        const potentialSegments: MidiSegment[] = [];
        let currentSegmentPoints: { x: number, continuousMidi: number, confidence: number }[] = [];
        let currentSegmentStartTime: number | null = null;

        for (let i = 0; i < history.length; i++) {
            const point = history[i]; // point.x is already adjusted time
            const isVoiced = point.confidence >= CONFIDENCE_THRESHOLD && point.continuousMidi !== null && Number.isFinite(point.continuousMidi);

            if (isVoiced) {
                const currentMidi = point.continuousMidi!;
                if (currentSegmentPoints.length === 0) {
                    currentSegmentStartTime = point.x;
                    currentSegmentPoints.push({ x: point.x, continuousMidi: currentMidi, confidence: point.confidence });
                } else {
                    const prevMidi = currentSegmentPoints[currentSegmentPoints.length - 1].continuousMidi;
                    const pitchDiff = Math.abs(currentMidi - prevMidi);

                    if (pitchDiff > PITCH_CHANGE_THRESHOLD_SEMITONES) {
                        const endTime = currentSegmentPoints[currentSegmentPoints.length - 1].x;
                        const duration = endTime - currentSegmentStartTime!;
                        if (duration >= MIN_NOTE_DURATION_MS && currentSegmentPoints.length > 0) {
                            const sumMidi = currentSegmentPoints.reduce((acc, p) => acc + p.continuousMidi, 0);
                            const sumConfidence = currentSegmentPoints.reduce((acc, p) => acc + p.confidence, 0);
                            potentialSegments.push({
                                startTime: currentSegmentStartTime!, endTime: endTime, duration: duration,
                                avgContinuousMidi: sumMidi / currentSegmentPoints.length,
                                avgConfidence: sumConfidence / currentSegmentPoints.length
                            });
                        }
                        currentSegmentStartTime = point.x;
                        currentSegmentPoints = [{ x: point.x, continuousMidi: currentMidi, confidence: point.confidence }];
                    } else {
                        currentSegmentPoints.push({ x: point.x, continuousMidi: currentMidi, confidence: point.confidence });
                    }
                }
            } else {
                if (currentSegmentPoints.length > 0) {
                    const endTime = currentSegmentPoints[currentSegmentPoints.length - 1].x;
                    const duration = endTime - currentSegmentStartTime!;
                    if (duration >= MIN_NOTE_DURATION_MS) {
                        const sumMidi = currentSegmentPoints.reduce((acc, p) => acc + p.continuousMidi, 0);
                        const sumConfidence = currentSegmentPoints.reduce((acc, p) => acc + p.confidence, 0);
                        potentialSegments.push({
                            startTime: currentSegmentStartTime!, endTime: endTime, duration: duration,
                            avgContinuousMidi: sumMidi / currentSegmentPoints.length,
                            avgConfidence: sumConfidence / currentSegmentPoints.length
                        });
                    }
                    currentSegmentPoints = [];
                    currentSegmentStartTime = null;
                }
            }
        }

        if (currentSegmentPoints.length > 0) {
            const endTime = currentSegmentPoints[currentSegmentPoints.length - 1].x;
            const duration = endTime - currentSegmentStartTime!;
            if (duration >= MIN_NOTE_DURATION_MS) {
                const sumMidi = currentSegmentPoints.reduce((acc, p) => acc + p.continuousMidi, 0);
                const sumConfidence = currentSegmentPoints.reduce((acc, p) => acc + p.confidence, 0);
                potentialSegments.push({
                    startTime: currentSegmentStartTime!, endTime: endTime, duration: duration,
                    avgContinuousMidi: sumMidi / currentSegmentPoints.length,
                    avgConfidence: sumConfidence / currentSegmentPoints.length
                });
            }
        }

        // Merge logic remains the same, operates on adjusted timestamps
        const mergedSegments: MidiSegment[] = [];
        if (potentialSegments.length > 0) {
            mergedSegments.push(potentialSegments[0]);
            for (let i = 1; i < potentialSegments.length; i++) {
                const prev = mergedSegments[mergedSegments.length - 1];
                const curr = potentialSegments[i];
                const gap = curr.startTime - prev.endTime; // Gap in adjusted time
                const prevMidi = prev.avgContinuousMidi;
                const currMidi = curr.avgContinuousMidi;

                if (prevMidi !== null && currMidi !== null && Number.isFinite(prevMidi) && Number.isFinite(currMidi)) {
                    const pitchDiff = Math.abs(currMidi - prevMidi);
                    if (gap > 0 && gap < MAX_GAP_MS_FOR_MERGE && pitchDiff < PITCH_DIFF_FOR_MERGE_SEMITONES) {
                        const totalPointsDuration = prev.duration + curr.duration;
                        if (totalPointsDuration > 0) {
                            const weightedAvgMidi = ((prevMidi * prev.duration) + (currMidi * curr.duration)) / totalPointsDuration;
                            const weightedAvgConfidence = ((prev.avgConfidence * prev.duration) + (curr.avgConfidence * curr.duration)) / totalPointsDuration;
                            mergedSegments[mergedSegments.length - 1] = {
                                ...prev,
                                endTime: curr.endTime,
                                duration: prev.duration + gap + curr.duration,
                                avgContinuousMidi: weightedAvgMidi,
                                avgConfidence: weightedAvgConfidence,
                            };
                            continue;
                        }
                    }
                }
                mergedSegments.push(curr);
            }
        }
        setSegmentedNotes(mergedSegments);
    };

    const handlePitchUpdate = (smoothedPitchHz: number | null, detectedConfidence: number) => {
        // Calculate adjusted time for this update
        const adjustedNow = getAdjustedNow();

        const currentNoteDetails = getNoteDetails(smoothedPitchHz);
        const currentContinuousMidi = currentNoteDetails?.continuousMidi ?? null;
        const currentRoundedMidi = currentNoteDetails?.midi ?? null;

        // Update instantaneous values
        setPitch(smoothedPitchHz);
        setConfidence(detectedConfidence);
        setNoteDetails(currentNoteDetails);

        // Update History Data using ADJUSTED time
        const newHistoryPoint: PitchHistoryPoint = {
            x: adjustedNow, // Use adjusted time
            y: currentRoundedMidi,
            confidence: detectedConfidence,
            continuousMidi: currentContinuousMidi
        };

        // Update pitch history (used for display filtering, relative to adjusted time)
        setPitchHistory(prev => {
            const updated = [...prev, newHistoryPoint];
            // Filter points older than CHART_DURATION_SECONDS based on adjusted time
            const cutoff = adjustedNow - (CHART_DURATION_SECONDS * 1000);
            const timeFiltered = updated.filter(p => p.x >= cutoff);
            return timeFiltered;
        });

        // Update full history (used for segmentation) using ADJUSTED time
        setFullPitchHistory(prev => [...prev, newHistoryPoint]);

        // Trigger Segmentation using the history which contains ADJUSTED time
        generateMidiSegments(fullPitchHistory());

        // Update Piano Roll Time Window using ADJUSTED time
        setViewEndTime(adjustedNow);
        setViewStartTime(adjustedNow - VIEW_DURATION_SECONDS * 1000);
    };

    const handleError = (errorMessage: string) => {
        console.error("[Demo Page] Error Handler:", errorMessage);
        setError(errorMessage);
        setIsProcessing(false);
        setIsInitializing(false);
        setNoteDetails(null);
        // Reset history and pause state on error
        setPitchHistory([]);
        setFullPitchHistory([]);
        setSegmentedNotes([]);
        setPauseOffset(0);
        setPauseStartTime(0); // Reset pause start time
    };

    const handleModelLoaded = () => {
        setIsInitializing(false);
        setIsServiceReady(true);
        // Reset pause state fully on initial load
        if (pauseStartTime() === 0 && pauseOffset() === 0) { // Check if truly initial load/reset
            setPauseStartTime(0);
            setPauseOffset(0);
        }
        // Initialize view window based on current adjusted time
        // The createEffect also handles this, but setting here ensures it's correct before potential auto-start
        const now = getAdjustedNow();
        setViewEndTime(now);
        setViewStartTime(now - VIEW_DURATION_SECONDS * 1000);

        if (startAfterInit()) {
            startProcessing(); // Will correctly handle pause state if needed
            setStartAfterInit(false);
        }
    };

    const initializeAudio = async () => {
        if (serviceInstance || isInitializing()) return;
        setError(null);
        setIsInitializing(true);
        setIsServiceReady(false);
        setStartAfterInit(true); // Flag to start automatically after init completes
        setNoteDetails(null);
        // Clear history and reset pause state fully for a fresh start
        setPitchHistory([]);
        setFullPitchHistory([]);
        setSegmentedNotes([]);
        setPauseOffset(0);
        setPauseStartTime(0); // Reset pause start time

        // Initialize view window based on adjusted time (offset is 0 now)
        const now = getAdjustedNow();
        setViewEndTime(now);
        setViewStartTime(now - VIEW_DURATION_SECONDS * 1000);

        const options = { smoothingFactor: 0.9, resetThresholdInCents: 100 };
        serviceInstance = new PitchDetectionService(handlePitchUpdate, handleError, handleModelLoaded, options);
        serviceInstance.initialize();
    };

    const startProcessing = async () => { // Called for initial start AND resume
        if (!serviceInstance || !isServiceReady() || isProcessing() || isInitializing()) {
            if (isInitializing()) {
                setStartAfterInit(true);
            }
            return;
        }
        setError(null);

        // If resuming from a pause, calculate duration and update offset
        if (pauseStartTime() > 0) {
            const pauseDuration = Date.now() - pauseStartTime();
            setPauseOffset(prev => prev + pauseDuration);
            setPauseStartTime(0); // Reset pause start time marker after using it
        }
        // If not resuming (pauseStartTime is 0), pauseOffset remains unchanged

        await serviceInstance.start();
        // Check if start was successful before setting processing state
        if (serviceInstance.isProcessing) {
            setIsProcessing(true);
        } else if (!error()) { // If start failed but no error was caught by handler
            handleError("Failed to start audio processing.");
        }
    };

    const stopProcessing = async () => { // Called only when pausing/stopping
        if (!serviceInstance || !isProcessing()) return;

        // Record the time the pause started *before* stopping service
        setPauseStartTime(Date.now());
        // DO NOT update pauseOffset here

        await serviceInstance.stop();
        setIsProcessing(false); // Update state *after* successful stop

        // Final segmentation based on the history using adjusted time
        generateMidiSegments(fullPitchHistory());
    };

    onMount(() => {
        // Initial view window setup handled by initializeAudio/handleModelLoaded
    });

    onCleanup(async () => {
        if (serviceInstance) {
            await serviceInstance.cleanup();
            serviceInstance = null;
        }
        // Reset all relevant state on cleanup
        setIsProcessing(false);
        setIsServiceReady(false);
        setIsInitializing(false);
        setError(null);
        setPitch(null);
        setConfidence(0);
        setNoteDetails(null);
        setPitchHistory([]);
        setFullPitchHistory([]);
        setSegmentedNotes([]);
        setStartAfterInit(false);
        // Reset pause state on cleanup
        setPauseOffset(0);
        setPauseStartTime(0); // Reset pause start time
        setViewStartTime(0);
        setViewEndTime(0);
    });

    return (
        <div class="flex flex-col h-screen bg-gray-800 font-sans overflow-hidden relative">

            {/* Tooltip Container */}
            <div
                id="piano-roll-tooltip"
                class="absolute z-10 p-2 text-xs text-gray-100 bg-gray-900/90 rounded shadow-lg pointer-events-none opacity-0 transition-opacity duration-150"
                style="backdrop-filter: blur(2px);" // Optional: Adds a blur effect behind the tooltip
            ></div>

            <main class="flex-grow flex flex-col relative">
                <div class="flex-grow relative">
                    <div class="absolute inset-0 bg-gray-800 overflow-hidden">
                        <PianoRoll
                            notes={segmentedNotes()} // Pass notes with adjusted time
                            viewStartTime={viewStartTime()} // Pass view window with adjusted time
                            viewEndTime={viewEndTime()}     // Pass view window with adjusted time
                            minMidiNote={36}
                            maxMidiNote={84}
                        />
                    </div>
                </div>
            </main>

            <ControlBar
                pitch={pitch}
                confidence={confidence}
                noteDetails={noteDetails}
                isProcessing={isProcessing}
                isServiceReady={isServiceReady}
                isInitializing={isInitializing}
                error={error}
                onInitialize={initializeAudio} // Resets pause state
                onStart={startProcessing}     // Updates pauseOffset if resuming
                onStop={stopProcessing}       // Sets pauseStartTime
            />
        </div>
    );
};

export default Demo; 