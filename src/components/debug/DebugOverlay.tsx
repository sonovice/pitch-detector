import { Component, Accessor, Setter, createEffect } from 'solid-js';
import { HelpCircle } from 'lucide-solid';

interface DebugOverlayProps {
    // Signals
    confidenceThreshold: Accessor<number>;
    pitchChangeThreshold: Accessor<number>;
    minNoteDuration: Accessor<number>;
    maxGapForMerge: Accessor<number>;
    pitchDiffForMerge: Accessor<number>;
    smoothingFactor: Accessor<number>;
    resetThreshold: Accessor<number>;
    chartDuration: Accessor<number>;
    // Setters
    setConfidenceThreshold: Setter<number>;
    setPitchChangeThreshold: Setter<number>;
    setMinNoteDuration: Setter<number>;
    setMaxGapForMerge: Setter<number>;
    setPitchDiffForMerge: Setter<number>;
    setSmoothingFactor: Setter<number>;
    setResetThreshold: Setter<number>;
    setChartDuration: Setter<number>;
}

const DebugOverlay: Component<DebugOverlayProps> = (props) => {

    // Helper to handle slider input (event type might be generic)
    const handleSliderChange = (setter: Setter<number>, event: Event) => {
        const target = event.target as HTMLInputElement;
        setter(parseFloat(target.value));
    };

    return (
        <div class="absolute top-4 right-4 z-20 p-4 rounded-lg shadow-xl bg-gray-900/80 text-gray-200 text-xs backdrop-blur-md border border-gray-700 max-w-xs w-full max-h-[85vh] overflow-y-auto">
            <h3 class="text-sm font-semibold mb-3 text-gray-100 border-b border-gray-700 pb-1">Hyperparameters</h3>
            <div class="space-y-4">

                {/* --- Segmentation Group --- */}
                <div>
                    <h4 class="text-xs font-bold uppercase text-gray-400 mb-2">Segmentation</h4>
                    <div class="space-y-3 pl-2 border-l border-gray-700">
                        {/* Confidence Threshold */}
                        <div>
                            <div class="flex items-center justify-between mb-1">
                                <label class="block font-medium" for="confThreshold">Confidence Threshold ({props.confidenceThreshold().toFixed(2)})</label>
                                <span title="Minimum pitch detection confidence needed to consider audio 'voiced'.">
                                    <HelpCircle size={16} class="text-gray-500" />
                                </span>
                            </div>
                            <input
                                type="range" id="confThreshold" min="0.1" max="0.95" step="0.01"
                                value={props.confidenceThreshold()}
                                onInput={(e) => handleSliderChange(props.setConfidenceThreshold, e)}
                                class="w-full h-1.5 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                            />
                        </div>
                        {/* Pitch Change Threshold */}
                        <div>
                            <div class="flex items-center justify-between mb-1">
                                <label class="block font-medium" for="pitchChange">Pitch Change Thresh. ({props.pitchChangeThreshold().toFixed(2)} st)</label>
                                <span title="Minimum pitch difference (semitones) to trigger a new note segment.">
                                    <HelpCircle size={16} class="text-gray-500" />
                                </span>
                            </div>
                            <input
                                type="range" id="pitchChange" min="0.1" max="2.0" step="0.05"
                                value={props.pitchChangeThreshold()}
                                onInput={(e) => handleSliderChange(props.setPitchChangeThreshold, e)}
                                class="w-full h-1.5 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                            />
                        </div>
                        {/* Min Note Duration */}
                        <div>
                            <div class="flex items-center justify-between mb-1">
                                <label class="block font-medium" for="minDuration">Min Note Duration ({props.minNoteDuration()} ms)</label>
                                <span title="Minimum duration (milliseconds) for a detected segment to be considered a valid note.">
                                    <HelpCircle size={16} class="text-gray-500" />
                                </span>
                            </div>
                            <input
                                type="range" id="minDuration" min="10" max="500" step="10"
                                value={props.minNoteDuration()}
                                onInput={(e) => handleSliderChange(props.setMinNoteDuration, e)}
                                class="w-full h-1.5 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                            />
                        </div>
                    </div>
                </div>

                {/* --- Merging Group --- */}
                <div>
                    <h4 class="text-xs font-bold uppercase text-gray-400 mb-2">Note Merging</h4>
                    <div class="space-y-3 pl-2 border-l border-gray-700">
                        {/* Max Gap For Merge */}
                        <div>
                            <div class="flex items-center justify-between mb-1">
                                <label class="block font-medium" for="maxGap">Max Gap For Merge ({props.maxGapForMerge()} ms)</label>
                                <span title="Maximum gap (milliseconds) between two note segments to consider merging them.">
                                    <HelpCircle size={16} class="text-gray-500" />
                                </span>
                            </div>
                            <input
                                type="range" id="maxGap" min="0" max="500" step="10"
                                value={props.maxGapForMerge()}
                                onInput={(e) => handleSliderChange(props.setMaxGapForMerge, e)}
                                class="w-full h-1.5 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                            />
                        </div>
                        {/* Pitch Diff For Merge */}
                        <div>
                            <div class="flex items-center justify-between mb-1">
                                <label class="block font-medium" for="pitchDiffMerge">Pitch Diff For Merge ({props.pitchDiffForMerge().toFixed(2)} st)</label>
                                <span title="Maximum pitch difference (semitones) between two adjacent segments allowed for merging.">
                                    <HelpCircle size={16} class="text-gray-500" />
                                </span>
                            </div>
                            <input
                                type="range" id="pitchDiffMerge" min="0.05" max="1.5" step="0.05"
                                value={props.pitchDiffForMerge()}
                                onInput={(e) => handleSliderChange(props.setPitchDiffForMerge, e)}
                                class="w-full h-1.5 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                            />
                        </div>
                    </div>
                </div>

                {/* --- Smoothing Group --- */}
                <div>
                    <h4 class="text-xs font-bold uppercase text-gray-400 mb-2">Smoothing</h4>
                    <div class="space-y-3 pl-2 border-l border-gray-700">
                        {/* Smoothing Factor */}
                        <div>
                            <div class="flex items-center justify-between mb-1">
                                <label class="block font-medium" for="smoothingFactor">Smoothing Factor ({props.smoothingFactor().toFixed(3)})</label>
                                <span title="Amount of EMA smoothing applied to raw pitch (0=None, ~0.9=High). Affects displayed pitch and segmentation stability.">
                                    <HelpCircle size={16} class="text-gray-500" />
                                </span>
                            </div>
                            <input
                                type="range" id="smoothingFactor" min="0" max="0.99" step="0.01"
                                value={props.smoothingFactor()}
                                onInput={(e) => handleSliderChange(props.setSmoothingFactor, e)}
                                class="w-full h-1.5 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                            />
                        </div>
                        {/* Reset Threshold */}
                        <div>
                            <div class="flex items-center justify-between mb-1">
                                <label class="block font-medium" for="resetThreshold">Reset Threshold ({props.resetThreshold()} cents)</label>
                                <span title="If pitch jumps by more than this amount (cents), smoothing is reset to the new pitch for faster reaction.">
                                    <HelpCircle size={16} class="text-gray-500" />
                                </span>
                            </div>
                            <input
                                type="range" id="resetThreshold" min="0" max="500" step="5"
                                value={props.resetThreshold()}
                                onInput={(e) => handleSliderChange(props.setResetThreshold, e)}
                                class="w-full h-1.5 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                            />
                        </div>
                    </div>
                </div>

                {/* --- Display Group --- */}
                <div>
                    <h4 class="text-xs font-bold uppercase text-gray-400 mb-2">Display</h4>
                    <div class="space-y-3 pl-2 border-l border-gray-700">
                        {/* Chart Duration */}
                        <div>
                            <div class="flex items-center justify-between mb-1">
                                <label class="block font-medium" for="chartDuration">History Filter Dur. ({props.chartDuration()} s)</label>
                                <span title="Duration (seconds) of raw pitch history points kept for potential display (separate from main view window duration).">
                                    <HelpCircle size={16} class="text-gray-500" />
                                </span>
                            </div>
                            <input
                                type="range" id="chartDuration" min="5" max="60" step="1"
                                value={props.chartDuration()}
                                onInput={(e) => handleSliderChange(props.setChartDuration, e)}
                                class="w-full h-1.5 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DebugOverlay; 