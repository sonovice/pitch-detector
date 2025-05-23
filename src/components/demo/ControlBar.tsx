import { Component, Show, Accessor } from 'solid-js';
import { Mic, Square, AlertTriangle, ZoomIn, ZoomOut } from 'lucide-solid';
import type { NoteDetails } from '../../utils/midiUtils'; // Import the type
import TuningMeter from './TuningMeter';

interface ControlBarProps {
    pitch: Accessor<number | null>;
    confidence: Accessor<number>;
    noteDetails: Accessor<NoteDetails | null>;
    isProcessing: Accessor<boolean>;
    isServiceReady: Accessor<boolean>;
    isInitializing: Accessor<boolean>;
    error: Accessor<string | null>;
    onInitialize: () => void;
    onStart: () => void;
    onStop: () => void;
}

const ControlBar: Component<ControlBarProps> = (props) => {
    return (
        <footer class="flex-shrink-0 bg-gray-950 p-4 flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0 border-t border-gray-800">

            {/* Left Info Cluster - Remove absolute positioning */}
            {/* Added order-2 md:order-1 to place it first on larger screens */}
            <div class="flex items-center flex-wrap justify-center md:justify-start space-x-4 md:space-x-6 text-sm text-gray-400 order-2 md:order-1">
                {/* Frequency & Note */}
                <div class="flex items-baseline space-x-1.5 min-w-[180px]">
                    <span class="text-gray-500 text-xs uppercase tracking-wider">Pitch</span>
                    <span class="font-semibold text-lg text-gray-100 tabular-nums w-20 truncate text-left" title={props.pitch() ? `${props.pitch()!.toFixed(1)} Hz` : ''}>
                        {props.pitch() ? `${props.pitch()!.toFixed(1)} Hz` : '--'}
                    </span>
                    <Show when={props.noteDetails()}>
                        <span class="font-medium text-lg text-cyan-400">({props.noteDetails()!.name})</span>
                    </Show>
                </div>
                {/* Confidence */}
                <div class="flex items-baseline space-x-1.5">
                    <span class="text-gray-500 text-xs uppercase tracking-wider">Conf</span>
                    <span class="font-semibold text-lg text-gray-100 tabular-nums w-12 text-left">
                        {props.confidence() > 0 ? (props.confidence() * 100).toFixed(0) + '%' : '--'}
                    </span>
                </div>
            </div>

            {/* Center Button - Added order-1 md:order-2 to place it center on larger screens */}
            <div class="flex-shrink-0 order-1 md:order-2">
                <Show
                    when={props.isProcessing()}
                    fallback={
                        <button
                            onClick={() => {
                                if (!props.isServiceReady() && !props.isInitializing()) {
                                    props.onInitialize();
                                }
                                else if (props.isServiceReady()) {
                                    props.onStart();
                                }
                            }}
                            class={`
                                relative w-16 h-16 rounded-full flex items-center justify-center transition-colors duration-150 ease-in-out 
                                text-white 
                                bg-gradient-to-br from-green-600 to-green-800 hover:from-green-500 hover:to-green-700 
                                shadow-lg hover:shadow-xl
                                focus:outline-none focus:ring-4 focus:ring-green-500/50 
                                disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:shadow-none disabled:from-gray-600 disabled:to-gray-800
                                ${props.isInitializing() ? 'animate-pulse' : ''}
                            `}
                            disabled={props.isInitializing()}
                            aria-label={props.isInitializing() ? "Initializing..." : props.isServiceReady() ? "Start Pitch Detection" : "Initialize and Start Pitch Detection"}
                            title={props.isInitializing() ? "Initializing..." : props.isServiceReady() ? "Start Pitch Detection" : "Initialize and Start Pitch Detection"}
                        >
                            <Mic size={32} stroke-width={1.5} />
                        </button>
                    }
                >
                    <button
                        onClick={props.onStop}
                        class={`
                            relative w-16 h-16 rounded-full flex items-center justify-center transition-colors duration-150 ease-in-out 
                            text-white 
                            bg-gradient-to-br from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 
                            shadow-lg hover:shadow-xl
                            focus:outline-none focus:ring-4 focus:ring-red-500/50 
                        `}
                        aria-label="Stop Pitch Detection"
                        title="Stop Pitch Detection"
                    >
                        <Square size={26} fill="currentColor" stroke-width={1.5} />
                    </button>
                </Show>
            </div>

            {/* Right Info Cluster - Remove absolute positioning */}
            {/* Added order-3 for consistent order */}
            <div class="flex items-center flex-wrap justify-center md:justify-end space-x-4 md:space-x-6 text-sm text-gray-400 order-3">
                <TuningMeter noteDetails={props.noteDetails()} />

                <div class="flex items-center space-x-2">
                    <span class={`
                        h-3.5 w-3.5 rounded-full border-2 border-gray-700 
                        ${props.isProcessing() ? 'bg-green-500 border-green-400 animate-pulse' :
                            props.isInitializing() ? 'bg-yellow-500 border-yellow-400 animate-pulse' :
                                props.isServiceReady() ? 'bg-blue-500 border-blue-400' :
                                    'bg-gray-600'}
                    `}></span>
                    <span class="font-medium text-gray-300 w-24 text-left">
                        {props.isProcessing() ? 'Listening...' :
                            props.isInitializing() ? 'Initializing...' :
                                props.isServiceReady() ? 'Ready' :
                                    'Not Ready'}
                    </span>
                </div>

                <Show when={props.error()}>
                    <div class="flex items-center space-x-1.5 text-red-500 hover:text-red-400 cursor-help" title={props.error() ?? ''}>
                        <AlertTriangle size={18} />
                        <span class="font-medium">Error</span>
                    </div>
                </Show>
            </div>
        </footer>
    );
};

export default ControlBar; 