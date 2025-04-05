/// <reference lib="webworker" />
// src/lib/pitch-detection/pitchForwarderProcessor.ts

// --- Type Declarations for AudioWorklet Environment --- 
declare var registerProcessor: (
    name: string,
    processorCtor: (new (options?: AudioWorkletNodeOptions) => AudioWorkletProcessor)
) => void;

interface AudioWorkletProcessor {
    readonly port: MessagePort;
    process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, Float32Array>): boolean;
}
declare var AudioWorkletProcessor: {
    prototype: AudioWorkletProcessor;
    new(options?: AudioWorkletNodeOptions): AudioWorkletProcessor;
};
// --- End Type Declarations ---

/**
 * An AudioWorkletProcessor that forwards raw audio chunks from the audio thread
 * back to the main thread (AudioService) via its MessagePort.
 */
class PitchForwarderProcessor extends AudioWorkletProcessor {

    /** Audio buffer size is determined by the system, typically 128 samples per process call. */
    static get parameterDescriptors() {
        return []; // No parameters needed for this processor
    }

    constructor(options?: AudioWorkletNodeOptions) {
        super(options);
        // console.log("[PitchForwarderProcessor] Initialized.");

        this.port.onmessage = (event) => {
            // Handle messages from main thread if needed
            // console.log("[PitchForwarderProcessor] Message from main thread:", event.data);
        };
        this.port.onmessageerror = (err) => {
            console.error("[PitchForwarderProcessor] Error receiving message:", err);
        }
    }

    /**
     * Called by the audio engine to process audio blocks.
     * Forwards the input audio data (first channel) to the main thread.
     * @returns {boolean} Return true to keep the processor alive.
     */
    process(
        inputs: Float32Array[][],
        outputs: Float32Array[][],
        parameters: Record<string, Float32Array>
    ): boolean {
        const inputChannel = inputs[0]?.[0];

        if (inputChannel && inputChannel.length > 0) {
            try {
                // Post a *copy* of the audio data back to the main thread.
                this.port.postMessage({
                    type: 'audioData',
                    data: inputChannel.slice()
                });
            } catch (error: any) {
                console.error("[PitchForwarderProcessor] Error posting message:", error);
                // Optionally return false to stop processing if errors persist
            }
        }
        return true; // Keep processor alive
    }
}

// Register the processor for use by AudioWorkletNode
try {
    registerProcessor('pitch-forwarder-processor', PitchForwarderProcessor);
} catch (error) {
    console.error("Failed to register PitchForwarderProcessor:", error);
} 