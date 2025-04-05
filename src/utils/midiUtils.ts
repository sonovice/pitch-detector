export const A4 = 440;
export const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const MIDI_A4 = 69;

/** Calculates the MIDI note number from a frequency (Hz). */
export function hzToMidi(hz: number | null): number | null {
    if (hz === null || hz <= 0) return null;
    const midiNum = MIDI_A4 + 12 * Math.log2(hz / A4);
    return Math.round(midiNum);
}

/** Calculates the continuous (non-rounded) MIDI note number from a frequency (Hz). */
export function hzToContinuousMidi(hz: number | null): number | null {
    if (hz === null || hz <= 0) return null;
    // Same formula as hzToMidi, but without Math.round()
    return MIDI_A4 + 12 * Math.log2(hz / A4);
}

/** Converts a MIDI note number to its standard name (e.g., C4, F#5). */
export function midiToNoteName(midi: number | null): string {
    if (midi === null || !Number.isFinite(midi)) return 'N/A'; // Check isFinite
    const roundedMidi = Math.round(midi); // Round for name lookup
    if (!Number.isInteger(roundedMidi)) return 'N/A';
    const octave = Math.floor(roundedMidi / 12) - 1;
    const noteIndex = roundedMidi % 12;
    return noteNames[noteIndex] + octave;
}

export type NoteDetails = {
    name: string;
    targetHz: number;
    centsOffset: number;
    midi: number | null;
    continuousMidi: number | null;
};


/** Calculates details about the nearest musical note for a given frequency. */
export function getNoteDetails(hz: number | null): NoteDetails | null {
    if (hz === null || hz <= 0) return null;

    // 1. Calculate the continuous MIDI note number
    const continuousMidi = hzToContinuousMidi(hz);
    if (continuousMidi === null || !Number.isFinite(continuousMidi)) return null;

    // 2. Calculate the standard MIDI note number for the detected frequency
    const roundedMidi = Math.round(continuousMidi);
    if (!Number.isInteger(roundedMidi)) return null; // Ensure we have a valid integer MIDI number

    // 3. Get the note name (e.g., A4, C#5)
    const noteName = midiToNoteName(roundedMidi);

    // 4. Calculate the target frequency (Hz) of the *exact* nearest standard MIDI note
    const targetHz = A4 * Math.pow(2, (roundedMidi - MIDI_A4) / 12);
    if (!Number.isFinite(targetHz)) return null; // Add check for finite target Hz

    // 5. Calculate the difference in cents between the detected frequency and the target frequency
    const centsOffset = 1200 * Math.log2(hz / targetHz);
    if (!Number.isFinite(centsOffset)) return null; // Add check for finite cents offset

    // 6. Return the details, including both rounded and continuous MIDI
    return { name: noteName, targetHz: targetHz, centsOffset: centsOffset, midi: roundedMidi, continuousMidi: continuousMidi };
} 