import { Component, Show } from 'solid-js';
import type { NoteDetails } from '../../utils/midiUtils'; // Import the type

interface TuningMeterProps {
    noteDetails: NoteDetails | null;
}

const TuningMeter: Component<TuningMeterProps> = (props) => {
    return (
        <div class="flex items-center space-x-2">
            <span class="text-gray-500 text-xs uppercase tracking-wider">Tune</span>
            <div class="w-28 h-1.5 bg-gray-700 rounded-full overflow-hidden relative border border-gray-600">
                <div class="absolute left-1/2 top-0 bottom-0 w-px bg-gray-500 transform -translate-x-1/2"></div>
                <Show when={props.noteDetails && Math.abs(props.noteDetails.centsOffset) <= 50}>
                    {(() => {
                        const offset = props.noteDetails!.centsOffset;
                        const absOffset = Math.abs(offset);
                        let bgColor = 'bg-red-500';
                        let glow = '';
                        if (absOffset <= 5) { bgColor = 'bg-green-400'; glow = 'shadow-[0_0_4px_rgba(74,222,128,0.7)]'; }
                        else if (absOffset <= 15) { bgColor = 'bg-yellow-400'; }
                        else if (absOffset <= 30) { bgColor = 'bg-orange-400'; }
                        return (
                            <div
                                class={`absolute top-[-2px] bottom-[-2px] w-1 rounded ${bgColor} ${glow}`}
                                style={{ left: `${(offset + 50)}%`, transform: `translateX(-50%)`, transition: 'left 0.1s ease-out' }}
                            ></div>
                        );
                    })()}
                </Show>
            </div>
            <span class="font-medium text-gray-300 text-right tabular-nums w-10">
                {props.noteDetails ? `${props.noteDetails.centsOffset.toFixed(0)}c` : '--'}
            </span>
        </div>
    );
};

export default TuningMeter; 