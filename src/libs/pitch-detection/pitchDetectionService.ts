const MODEL_SAMPLE_RATE = 16000;
// No longer need ScriptProcessorNode buffer size
// const SCRIPT_PROCESSOR_BUFFER_SIZE = 1024;

// Define callback types
/** Callback function type for pitch updates. */
type PitchUpdateCallback = (pitch: number | null, confidence: number) => void;
/** Callback function type for reporting errors. */
type ErrorCallback = (errorMessage: string) => void;
/** Callback function type for signaling when the service is fully initialized (model loaded). */
type ModelLoadedCallback = () => void;

/** Optional parameters for configuring the PitchDetectionService. */
interface PitchDetectionServiceOptions {
    /** 
     * EMA smoothing factor (0 to 1). 0 = No smoothing. Higher values (~0.9) = More smoothing. Defaults to 0.
     */
    smoothingFactor?: number;
    /** 
     * Threshold (in cents) for resetting smoothing. If the difference between the new raw pitch
     * and the current smoothed pitch exceeds this value, the smoothing is reset to the new pitch.
     * Helps react faster to large jumps. Defaults to 100 cents (1 semitone).
     */
    resetThresholdInCents?: number;
}

// Helper to calculate cents difference between two frequencies
function getCentsDifference(f1: number, f2: number): number {
    if (f1 <= 0 || f2 <= 0) return Infinity; // Avoid log(0) or division by zero
    return 1200 * Math.log2(f1 / f2);
}

/**
 * Manages audio context, microphone input, and communication between the
 * AudioWorklet (for audio capture) and a standard Worker (for TFJS processing)
 * to perform real-time pitch detection.
 */
export class PitchDetectionService {
    private audioContext: AudioContext | null = null;
    private microphoneNode: MediaStreamAudioSourceNode | null = null;
    // private scriptProcessorNode: ScriptProcessorNode | null = null; // Removed
    private pitchForwarderNode: AudioWorkletNode | null = null; // Added AudioWorkletNode
    private worker: Worker | null = null; // Standard worker for TFJS processing
    private mediaStream: MediaStream | null = null;

    // Callbacks
    private onPitchUpdate: PitchUpdateCallback;
    private onError: ErrorCallback;
    private onModelLoaded: ModelLoadedCallback;

    // State flags
    /** Indicates if the service is initialized (TFJS model loaded in worker). */
    public isInitialized: boolean = false; // Represents overall readiness (model loaded)
    // private workletReady = false; // Removed
    private modelReady = false;
    /** Indicates if the service is currently capturing and processing audio. */
    public isProcessing: boolean = false;

    // Smoothing
    private smoothingFactorInternal: number = 0.0;
    private resetThresholdInCents: number = 100.0; // Default threshold: 1 semitone
    private smoothedPitch: number | null = null;

    /**
     * Creates an instance of PitchDetectionService.
     * @param onPitchUpdate Callback executed when a new pitch is detected.
     * @param onError Callback executed when an error occurs.
     * @param onModelLoaded Callback executed when the service is ready.
     * @param options Optional configuration for the service.
     */
    constructor(onPitchUpdate: PitchUpdateCallback, onError: ErrorCallback, onModelLoaded: ModelLoadedCallback, options?: PitchDetectionServiceOptions) {
        this.onPitchUpdate = onPitchUpdate;
        this.onError = onError;
        this.onModelLoaded = onModelLoaded;

        if (options?.smoothingFactor !== undefined) {
            this.smoothingFactorInternal = Math.max(0, Math.min(0.999, options.smoothingFactor));
        }
        if (options?.resetThresholdInCents !== undefined) {
            this.resetThresholdInCents = Math.max(0, options.resetThresholdInCents); // Ensure positive threshold
        }
        console.log(`[PitchDetectionService] Smoothing factor: ${this.smoothingFactorInternal}, Reset Threshold: ${this.resetThresholdInCents} cents`);
    }

    /**
     * Initializes the service by creating the TFJS processing worker.
     * Waits for the worker to load the model before setting `isInitialized` to true.
     * AudioContext and AudioWorklet setup are deferred until start().
     */
    async initialize(): Promise<void> {
        if (this.isInitialized || this.modelReady) {
            console.warn("[PitchDetectionService] Already initialized or ready.");
            return;
        }
        // Reset state
        this.isInitialized = false;
        // this.workletReady = false; // Removed
        this.modelReady = false;
        this.isProcessing = false;
        this.smoothedPitch = null; // Reset smoothed pitch on init

        try {
            // --- Initialize Standard Worker (for TFJS) ---
            // console.log("Initializing TFJS audio worker...");
            this.worker = new Worker(new URL('./pitchDetectionWorker.ts', import.meta.url), {
                type: 'module'
            });
            // console.log("TFJS worker instance created.");
            this.worker.onmessage = (event: MessageEvent) => {
                const data = event.data;
                if (!data || typeof data !== 'object') return;

                if (data.type === 'pitch') {
                    const detectedPitch = data.pitch as number | null;
                    const confidence = data.confidence as number;

                    const alpha = 1.0 - this.smoothingFactorInternal;

                    if (detectedPitch === null) {
                        this.smoothedPitch = null;
                    } else {
                        // Check if we should reset smoothing due to a large jump
                        const centsDiff = this.smoothedPitch !== null
                            ? Math.abs(getCentsDifference(detectedPitch, this.smoothedPitch))
                            : Infinity; // Treat first pitch or reset as infinite difference

                        if (centsDiff > this.resetThresholdInCents || this.smoothedPitch === null || alpha === 1.0) {
                            // Reset or first pitch or no smoothing
                            this.smoothedPitch = detectedPitch;
                        } else {
                            // Apply EMA only for smaller changes
                            this.smoothedPitch = (detectedPitch * alpha) + (this.smoothedPitch * (1.0 - alpha));
                        }
                    }

                    this.onPitchUpdate(this.smoothedPitch, confidence);

                } else if (data.type === 'model_loaded') {
                    // console.log("[AudioService] Received 'model_loaded' message from TFJS worker.");
                    this.modelReady = true;
                    this.checkInitializationComplete();
                } else if (data.type === 'error') {
                    this.onError(`TFJS Worker Error: ${data.message}`);
                }
            };
            this.worker.onerror = (error: ErrorEvent) => {
                this.onError(`TFJS Worker onerror: ${error.message}`);
                this.cleanup(); // Assume fatal error
            };

            // --- Defer AudioContext & AudioWorklet --- 
            // console.log("AudioContext and AudioWorkletNode setup deferred until start().");

        } catch (error: any) {
            const errorMessage = `Initialization failed during worker setup: ${error?.message ?? error}`;
            console.error(errorMessage, error);
            this.onError(errorMessage);
            await this.cleanup();
        }
    }

    /** Checks if the model is loaded and updates the initialization status. */
    private checkInitializationComplete() {
        // console.log(`[AudioService] checkInitializationComplete called. modelReady: ${this.modelReady}, isInitialized: ${this.isInitialized}`);
        if (this.modelReady && !this.isInitialized) {
            // console.log("[AudioService] Conditions met. Setting isInitialized=true and calling onModelLoaded callback.");
            this.isInitialized = true;
            try {
                this.onModelLoaded(); // Signal readiness to the App
            } catch (callbackError: any) {
                console.error("[PitchDetectionService] Error executing onModelLoaded callback:", callbackError);
                this.onError(`Error in UI model loaded callback: ${callbackError.message}`);
            }
            // console.log("[AudioService] Initialization complete (Model ready).");
        }
    }

    /** Sets up the AudioWorklet node for forwarding audio data. */
    private async setupAudioWorklet(): Promise<boolean> {
        if (this.pitchForwarderNode || !this.audioContext) return !!this.pitchForwarderNode;

        try {
            // console.log("Setting up AudioWorklet (PitchForwarderProcessor)...");
            try {
                const processorUrl = new URL('./pitchForwarderProcessor.ts?url', import.meta.url);
                console.log('[PitchDetectionService] Attempting to load worklet module from URL:', processorUrl.toString());
                await this.audioContext.audioWorklet.addModule(processorUrl.toString());
                console.log("[PitchDetectionService] PitchForwarderProcessor module added successfully (or already added).");
            } catch (addError: any) {
                // Ignore error if it's specifically about the module already being added
                if (!addError.message.includes('already been added')) {
                    console.error('[PitchDetectionService] Error during addModule:', addError);
                    throw addError; // Re-throw other errors
                }
                console.log("[PitchDetectionService] PitchForwarderProcessor module likely already added.");
            }

            this.pitchForwarderNode = new AudioWorkletNode(this.audioContext, 'pitch-forwarder-processor');
            // console.log("PitchForwarderNode created.");

            // --- Setup Message Handling (Worklet -> Service -> Worker) ---
            this.pitchForwarderNode.port.onmessage = (event: MessageEvent) => {
                const data = event.data;
                if (data?.type === 'audioData') {
                    this.worker?.postMessage({
                        type: 'audioData',
                        data: data.data
                    });
                } else if (data?.type === 'error') {
                    this.onError(`PitchForwarderProcessor Error: ${data.message}`);
                }
            };
            this.pitchForwarderNode.port.onmessageerror = (err) => {
                this.onError(`Error receiving message from PitchForwarderNode port: ${err}`);
            };

            // No longer need workletReady flag
            // this.workletReady = true;
            // this.checkInitializationComplete();
            return true;

        } catch (error: any) {
            this.onError(`Failed to setup AudioWorklet: ${error.message}`);
            return false;
        }
    }

    /** Ensures the AudioContext is created (if necessary) and in a running state. Requires user gesture. */
    private async ensureAudioContext(): Promise<boolean> {
        if (!this.audioContext || this.audioContext.state === 'closed') {
            // console.log("Creating new AudioContext...");
            try {
                this.audioContext = new AudioContext({
                    sampleRate: MODEL_SAMPLE_RATE,
                    latencyHint: 'interactive',
                });
                this.audioContext.onstatechange = () => {
                    // console.log(`AudioContext state changed to: ${this.audioContext?.state}`);
                    if (this.audioContext?.state !== 'running' && this.isProcessing) {
                        this.onError(`AudioContext state changed unexpectedly: ${this.audioContext?.state}`);
                        this.stopInternal();
                    }
                };
            } catch (e: any) {
                this.onError(`Failed to create AudioContext: ${e.message}`);
                return false;
            }
        }

        if (this.audioContext.state === 'suspended') {
            // console.log("Resuming suspended AudioContext...");
            try {
                await this.audioContext.resume();
            } catch (e: any) {
                this.onError(`Failed to resume AudioContext: ${e.message}`);
                return false;
            }
        }

        if (this.audioContext.state !== 'running') {
            this.onError(`AudioContext is not running (state: ${this.audioContext.state})`);
            return false;
        }
        return true;
    }

    /**
     * Starts the audio processing pipeline.
     * Requires user interaction (e.g., button click) to succeed due to browser autoplay policies.
     * Ensures AudioContext is running, sets up AudioWorklet, requests microphone permission,
     * and connects the audio graph.
     */
    async start(): Promise<void> {
        // Initialization now means model is ready
        if (!this.isInitialized || !this.worker) {
            this.onError("PitchDetectionService not initialized (model not ready?). Initialize first.");
            return;
        }
        // Remove modelReady check here, isInitialized covers it
        // if (!this.modelReady) { ... }

        if (this.isProcessing) {
            // console.warn("Audio processing is already active.");
            return;
        }

        // --- Ensure AudioContext is running --- 
        const contextReady = await this.ensureAudioContext();
        if (!contextReady || !this.audioContext) {
            this.onError("AudioContext could not be started. Cannot start processing.");
            return;
        }

        // --- Setup AudioWorklet (Just-in-time) ---
        // This will create the node if it doesn't exist or return true if it does
        const workletSetupSuccess = await this.setupAudioWorklet();
        if (!workletSetupSuccess || !this.pitchForwarderNode) {
            this.onError("Failed to setup AudioWorklet node. Cannot start processing.");
            return;
        }

        // Removed check for isInitialized again, already checked at the start
        // if (!this.isInitialized) { ... }

        try {
            // Reset smoothed pitch when starting
            this.smoothedPitch = null;

            // console.log("Requesting microphone access...");
            // Get microphone stream only if we don't already have one (or if previous stopped)
            if (!this.mediaStream || this.mediaStream.getAudioTracks().every(t => t.readyState === 'ended')) {
                this.mediaStream = await navigator.mediaDevices.getUserMedia({
                    audio: { channelCount: 1, sampleRate: MODEL_SAMPLE_RATE, echoCancellation: false, noiseSuppression: false, autoGainControl: false },
                    video: false
                });
                // console.log("Microphone access granted/re-granted.");
                // Recreate source node if needed
                if (this.microphoneNode) {
                    try { this.microphoneNode.disconnect(); } catch (e) { /* ignore */ } // Disconnect old one if exists
                }
                this.microphoneNode = this.audioContext.createMediaStreamSource(this.mediaStream);
                // console.log("MediaStreamSource node created/recreated.");
            } else {
                // console.log("Using existing MediaStream.");
            }

            // --- Connect the audio graph --- 
            // Ensure nodes are valid before connecting
            if (!this.microphoneNode || !this.pitchForwarderNode) {
                throw new Error("Audio nodes are missing, cannot connect graph.");
            }
            try {
                this.microphoneNode.disconnect(); // Disconnect previous connections just in case
            } catch (e) { /* ignore */ }
            this.microphoneNode.connect(this.pitchForwarderNode);
            // this.pitchForwarderNode.connect(this.audioContext.destination); // Optional passthrough
            // console.log("Nodes connected: Microphone -> PitchForwarderNode");

            this.isProcessing = true;
            // console.log("Audio processing started.");

        } catch (error: any) {
            const errorMsg = `Failed to start audio processing: ${error?.message ?? error}`;
            console.error(errorMsg, error);
            this.onError(errorMsg);
            this.stopInternal(); // Cleanup on start failure
        }
    }

    /** Stops processing and disconnects nodes, keeping the context suspended and tracks active. */
    private stopInternal(): void {
        // console.log("Running internal stop...");
        this.isProcessing = false;

        // Disconnect AudioWorkletNode first
        if (this.pitchForwarderNode) {
            try {
                this.pitchForwarderNode.disconnect();
                // console.log("PitchForwarderNode disconnected.");
            } catch (e) {
                // console.warn("Error disconnecting PitchForwarderNode:", e);
            }
        }

        // Disconnect Microphone node
        if (this.microphoneNode) {
            try {
                this.microphoneNode.disconnect();
                // console.log("Microphone node disconnected.");
            } catch (e) {
                // console.warn("Error disconnecting microphone node:", e);
            }
            // Don't nullify microphoneNode if using existing stream on restart
            // this.microphoneNode = null;
        }

        // Stop media tracks
        if (this.mediaStream) {
            // Only stop tracks if we plan to fully cleanup or request a new stream next time
            // For simple stop/start, suspending context is often enough.
            // Let's keep tracks active for potential restart via context resume.
            // this.mediaStream.getTracks().forEach(track => track.stop());
            // console.log("MediaStream tracks stopped.");
            // console.log("MediaStream tracks kept active for potential resume.");
        }

        // console.log("Internal stop completed.");
    }

    /**
     * Public method to stop audio processing and suspend the AudioContext.
     */
    async stop(): Promise<void> {
        // console.log("Stopping audio processing (public method)...");
        this.stopInternal();

        // Suspend context
        if (this.audioContext && this.audioContext.state === 'running') {
            try {
                // console.log("Suspending AudioContext...");
                await this.audioContext.suspend();
                // console.log("AudioContext suspended.");
            } catch (e: any) {
                this.onError(`Error suspending AudioContext: ${e?.message}`);
            }
        }
        // console.log("Audio processing stopped (public method).");
    }

    /**
     * Completely stops processing, terminates the worker, closes the AudioContext,
     * and releases all resources. Call this when the service is no longer needed.
     */
    async cleanup(): Promise<void> {
        // console.log("Cleaning up AudioService completely...");
        this.stopInternal();

        // Terminate the standard worker
        if (this.worker) {
            // console.log("Terminating TFJS worker...");
            this.worker.terminate();
            this.worker = null;
        }

        // Clean up AudioWorkletNode reference and listeners
        if (this.pitchForwarderNode) {
            try {
                this.pitchForwarderNode.disconnect();
                this.pitchForwarderNode.port.onmessage = null;
                this.pitchForwarderNode.port.onmessageerror = null;
                // console.log("PitchForwarderNode listeners removed.");
            } catch (e) {
                // console.warn("Error cleaning up PitchForwarderNode listeners:", e);
            }
            this.pitchForwarderNode = null;
        }

        // Ensure microphoneNode is nullified during full cleanup
        this.microphoneNode = null;
        // Ensure mediaStream tracks are stopped during full cleanup
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            // console.log("MediaStream tracks stopped during cleanup.");
            this.mediaStream = null;
        }

        // Close the AudioContext
        if (this.audioContext && this.audioContext.state !== 'closed') {
            try {
                // console.log("Closing AudioContext...");
                if (this.audioContext.onstatechange) {
                    this.audioContext.onstatechange = null;
                }
                await this.audioContext.close();
                // console.log("AudioContext closed.");
            } catch (e: any) {
                console.error(`Error closing AudioContext during cleanup: ${e?.message}`);
            }
        }
        this.audioContext = null;

        this.isInitialized = false;
        // this.workletReady = false; // Removed
        this.modelReady = false;
        this.isProcessing = false;
        this.smoothedPitch = null; // Reset smoothed pitch on cleanup
        // console.log("AudioService cleanup finished.");
    }
} 