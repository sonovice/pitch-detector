import * as tf from '@tensorflow/tfjs';

// --- Constants ---
const NUM_INPUT_SAMPLES = 1024; // TF model input size
const MODEL_SAMPLE_RATE = 16000; // Expected sample rate for the model
const PT_OFFSET = 25.58; // Pitch tuning offset
const PT_SLOPE = 63.07; // Pitch tuning slope
const CONF_THRESHOLD = 0.8; // Minimum confidence level to consider a pitch valid
const MODEL_URL = 'https://tfhub.dev/google/tfjs-model/spice/2/default/1'; // SPICE model URL

// --- Worker State ---
let model: tf.GraphModel | null = null;
let modelLoaded = false;
/** Buffer to accumulate audio samples until NUM_INPUT_SAMPLES is reached. */
const sampleBuffer = new Float32Array(NUM_INPUT_SAMPLES);
/** Current write position in the sampleBuffer. */
let bufferPos = 0;

/** Converts a model pitch prediction (output unit) to Hertz. */
function getPitchHz(modelPitch: number): number {
    const fmin = 10.0; // Minimum frequency the model considers (Hz)
    const bins_per_octave = 12.0;
    const cqt_bin = modelPitch * PT_SLOPE + PT_OFFSET;
    return fmin * Math.pow(2.0, cqt_bin / bins_per_octave);
}

/** Loads the SPICE model from TensorFlow Hub. */
async function loadModel() {
    if (modelLoaded) return;
    try {
        // console.log('[Worker] Loading SPICE model...');
        await tf.setBackend('webgl');
        await tf.ready();
        // console.log(`[Worker] Using TF backend: ${tf.getBackend()}`);

        model = await tf.loadGraphModel(MODEL_URL, { fromTFHub: true });
        modelLoaded = true;
        // console.log('[Worker] SPICE model loaded successfully.');
        self.postMessage({ type: 'model_loaded' });
    } catch (error: any) {
        console.error('[Worker] Error loading SPICE model:', error);
        self.postMessage({ type: 'error', message: `Failed to load model: ${error.message || error}` });
    }
}

/** Runs the loaded model on the buffered audio data and posts the result. */
function runModel() {
    if (!modelLoaded || !model) return;

    tf.tidy(() => {
        const inputTensor = tf.tensor(sampleBuffer, [NUM_INPUT_SAMPLES]);
        try {
            const outputTensors = model!.execute({ "input_audio_samples": inputTensor }) as tf.Tensor[];
            const uncertainties = outputTensors[0].dataSync();
            const pitches = outputTensors[1].dataSync();

            let bestPitchHz: number | null = null;
            let highestConfidence = -1;

            for (let i = 0; i < pitches.length; ++i) {
                const confidence = 1.0 - uncertainties[i];
                if (confidence >= CONF_THRESHOLD && confidence > highestConfidence) {
                    highestConfidence = confidence;
                    bestPitchHz = getPitchHz(pitches[i]);
                }
            }

            self.postMessage({
                type: 'pitch',
                pitch: bestPitchHz,
                confidence: highestConfidence >= 0 ? highestConfidence : 0
            });

            outputTensors.forEach(t => t.dispose());

        } catch (error: any) {
            console.error("[Worker] Error during model execution:", error);
            self.postMessage({ type: 'error', message: `Model execution failed: ${error.message}` });
        } finally {
            inputTensor.dispose(); // Dispose input tensor
        }
    });
}

/** Handles incoming messages from the main thread (AudioService). */
self.onmessage = (event: MessageEvent) => {
    if (event.data.type === 'audioData') {
        const audioData: Float32Array = event.data.data;
        let currentInputPos = 0;
        while (currentInputPos < audioData.length) {
            const remainingBufferSpace = sampleBuffer.length - bufferPos;
            const chunkSize = Math.min(remainingBufferSpace, audioData.length - currentInputPos);
            sampleBuffer.set(audioData.subarray(currentInputPos, currentInputPos + chunkSize), bufferPos);
            bufferPos += chunkSize;
            currentInputPos += chunkSize;

            // If buffer is full, run inference
            if (bufferPos === sampleBuffer.length) {
                if (modelLoaded) {
                    runModel();
                } else {
                    // console.warn("[Worker] Model not loaded, dropping filled buffer.");
                }
                bufferPos = 0; // Reset buffer position
            }
        }
    }
    // Removed 'load' message type handling as model loads immediately
    // else if (event.data.type === 'load'){
    //     loadModel();
    // }
    else {
        console.log('[Worker] Received unknown message type:', event.data.type);
    }
};

/** Handles uncaught errors within the worker. */
self.onerror = (event: ErrorEvent) => {
    console.error('[Worker] Uncaught error:', event.message, event);
    self.postMessage({ type: 'error', message: `Worker uncaught error: ${event.message}` });
};

// console.log('[Worker] Worker script loaded.');
// Load the model immediately when the worker starts.
loadModel(); 