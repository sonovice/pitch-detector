import { Component, Accessor, Setter, createEffect } from 'solid-js';

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
        <div class="absolute top-4 right-4 z-20 p-4 rounded-lg shadow-xl bg-gray-900/80 text-gray-200 text-xs backdrop-blur-md border border-gray-700 max-w-xs w-full">
            <h3 class="text-sm font-semibold mb-3 text-gray-100 border-b border-gray-700 pb-1">Hyperparameters</h3>
            <div class="space-y-3">
                {/* Confidence Threshold */}
                <div>
                    <label class="block mb-1 font-medium" for="confThreshold">Confidence Threshold ({props.confidenceThreshold().toFixed(2)})</label>
                    <input
                        type="range" id="confThreshold" min="0.1" max="0.95" step="0.01"
                        value={props.confidenceThreshold()}
                        onInput={(e) => handleSliderChange(props.setConfidenceThreshold, e)}
                        class="w-full h-1.5 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                </div>
                {/* Pitch Change Threshold */}
                <div>
                    <label class="block mb-1 font-medium" for="pitchChange">Pitch Change Thresh. ({props.pitchChangeThreshold().toFixed(2)} semitones)</label>
                    <input
                        type="range" id="pitchChange" min="0.1" max="2.0" step="0.05"
                        value={props.pitchChangeThreshold()}
                        onInput={(e) => handleSliderChange(props.setPitchChangeThreshold, e)}
                        class="w-full h-1.5 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                </div>
                {/* Min Note Duration */}
                <div>
                    <label class="block mb-1 font-medium" for="minDuration">Min Note Duration ({props.minNoteDuration()} ms)</label>
                    <input
                        type="range" id="minDuration" min="10" max="500" step="10"
                        value={props.minNoteDuration()}
                        onInput={(e) => handleSliderChange(props.setMinNoteDuration, e)}
                        class="w-full h-1.5 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                </div>
                {/* Max Gap For Merge */}
                <div>
                    <label class="block mb-1 font-medium" for="maxGap">Max Gap For Merge ({props.maxGapForMerge()} ms)</label>
                    <input
                        type="range" id="maxGap" min="0" max="500" step="10"
                        value={props.maxGapForMerge()}
                        onInput={(e) => handleSliderChange(props.setMaxGapForMerge, e)}
                        class="w-full h-1.5 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                </div>
                {/* Pitch Diff For Merge */}
                <div>
                    <label class="block mb-1 font-medium" for="pitchDiffMerge">Pitch Diff For Merge ({props.pitchDiffForMerge().toFixed(2)} semitones)</label>
                    <input
                        type="range" id="pitchDiffMerge" min="0.05" max="1.5" step="0.05"
                        value={props.pitchDiffForMerge()}
                        onInput={(e) => handleSliderChange(props.setPitchDiffForMerge, e)}
                        class="w-full h-1.5 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                </div>
                {/* Smoothing Factor */}
                <div>
                    <label class="block mb-1 font-medium" for="smoothingFactor">Smoothing Factor ({props.smoothingFactor().toFixed(3)})</label>
                    <input
                        type="range" id="smoothingFactor" min="0" max="0.99" step="0.01"
                        value={props.smoothingFactor()}
                        onInput={(e) => handleSliderChange(props.setSmoothingFactor, e)}
                        class="w-full h-1.5 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                </div>
                {/* Reset Threshold */}
                <div>
                    <label class="block mb-1 font-medium" for="resetThreshold">Reset Threshold ({props.resetThreshold()} cents)</label>
                    <input
                        type="range" id="resetThreshold" min="0" max="500" step="5"
                        value={props.resetThreshold()}
                        onInput={(e) => handleSliderChange(props.setResetThreshold, e)}
                        class="w-full h-1.5 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                </div>
                {/* Chart Duration */}
                <div>
                    <label class="block mb-1 font-medium" for="chartDuration">History Filter Duration ({props.chartDuration()} s)</label>
                    <input
                        type="range" id="chartDuration" min="5" max="60" step="1"
                        value={props.chartDuration()}
                        onInput={(e) => handleSliderChange(props.setChartDuration, e)}
                        class="w-full h-1.5 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                </div>
            </div>
        </div>
    );
};

export default DebugOverlay; 