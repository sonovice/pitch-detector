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
import * as d3 from 'd3';
// Import MidiSegment type from Demo page, but midiToNoteName from utils
import type { MidiSegment } from '../pages/Demo';
import { midiToNoteName } from '../utils/midiUtils';

interface PianoRollProps {
    notes: MidiSegment[];
    viewStartTime: number; // Timestamp ms
    viewEndTime: number; // Timestamp ms
    minMidiNote?: number;
    maxMidiNote?: number;
}

const noteNamesSharp = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const NOTE_HEIGHT = 12;
const KEYBOARD_WIDTH = 60;

const PianoRoll: Component<PianoRollProps> = (props) => {
    let svgRef: SVGSVGElement | undefined;
    const minMidi = () => props.minMidiNote ?? 36; // C2
    const maxMidi = () => props.maxMidiNote ?? 84; // C6
    const [svgSize, setSvgSize] = createSignal({ width: 0, height: 0 });

    // D3 Selection for the tooltip element (defined outside this component)
    let tooltip: d3.Selection<HTMLDivElement, unknown, HTMLElement, any>;

    onMount(() => {
        if (!svgRef) return;

        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                const { width, height } = entry.contentRect;
                setSvgSize({ width, height });
            }
        });

        resizeObserver.observe(svgRef);

        const initialRect = svgRef.getBoundingClientRect();
        setSvgSize({ width: initialRect.width, height: initialRect.height });

        // Select the tooltip element after mount
        tooltip = d3.select<HTMLDivElement, unknown>("#piano-roll-tooltip");

        onCleanup(() => {
            resizeObserver.disconnect();
            // Hide tooltip on cleanup just in case
            if (tooltip) tooltip.style("opacity", 0);
        });
    });

    createEffect(() => {
        const currentSize = svgSize();
        const currentNotes = props.notes;
        const currentViewStart = props.viewStartTime;
        const currentViewEnd = props.viewEndTime;

        if (!svgRef || !tooltip) return; // Make sure tooltip selection exists
        const width = currentSize.width;
        const height = currentSize.height;

        if (currentNotes.length === 0 && (currentViewStart === currentViewEnd)) return;
        if (width <= 0 || height <= 0) return;

        const totalMidiNotes = maxMidi() - minMidi() + 1;
        const chartHeight = height;
        const chartWidth = width - KEYBOARD_WIDTH;

        const svg = d3.select(svgRef);
        svg.selectAll("*").remove();

        // Updated color palette based on screenshot
        const gridBackgroundColor = "#2d3748"; // Dark blue-gray
        const whiteKeyColor = "#e2e8f0";     // Light gray
        const blackKeyColor = "#4a5568";     // Medium-dark gray
        const lightGridLineColor = "#3a475a"; // Slightly lighter than bg
        const darkGridLineColor = "#4a5568";  // Same as black keys, for C lines
        const tuningLineColor = "#3a475a88";

        // Define the color scale for note tuning
        const tuningColorScale = d3.scaleLinear<string>()
            .domain([0, 5, 20, 40, 50]) // Absolute cents deviation thresholds
            .range(["#90ee90", "#90ee90", "#ffd700", "#ffa500", "#f8a5a5"]) // Green -> Yellow -> Orange -> Red
            .clamp(true); // Clamp input values to the domain

        const mainGroup = svg.append("g");
        const defs = svg.append("defs");

        mainGroup.append("rect")
            .attr("x", KEYBOARD_WIDTH)
            .attr("y", 0)
            .attr("width", chartWidth)
            .attr("height", chartHeight)
            .attr("fill", gridBackgroundColor);

        const gridGroup = mainGroup.append("g")
            .attr("class", "grid")
            .attr("transform", `translate(${KEYBOARD_WIDTH}, 0)`);

        const notesGroup = mainGroup.append("g")
            .attr("class", "notes")
            .attr("transform", `translate(${KEYBOARD_WIDTH}, 0)`);

        const keyboardGroup = mainGroup.append("g")
            .attr("class", "keyboard");

        const xScale = d3.scaleLinear()
            .domain([currentViewStart, currentViewEnd])
            .range([0, chartWidth]);

        const yScale = d3.scaleLinear()
            .domain([minMidi() - 0.5, maxMidi() + 0.5])
            .range([chartHeight, 0]);

        const midiRange = d3.range(minMidi(), maxMidi() + 1);
        keyboardGroup.selectAll("rect.key")
            .data(midiRange)
            .enter()
            .append("rect")
            .attr("class", d => {
                const noteIndex = d % 12;
                return noteIndex === 1 || noteIndex === 3 || noteIndex === 6 || noteIndex === 8 || noteIndex === 10 ? "key black-key" : "key white-key";
            })
            .attr("x", 0)
            .attr("y", d => yScale(d + 0.5))
            .attr("width", KEYBOARD_WIDTH)
            .attr("height", d => {
                const keyTopY = yScale(d + 0.5);
                const keyBottomY = yScale(d - 0.5);
                return Math.max(1, keyBottomY - keyTopY - 1);
            })
            .attr("fill", d => {
                const noteIndex = d % 12;
                return noteIndex === 1 || noteIndex === 3 || noteIndex === 6 || noteIndex === 8 || noteIndex === 10 ? blackKeyColor : whiteKeyColor;
            })
            .attr("stroke", "#666")
            .attr("stroke-width", 0.5);

        keyboardGroup.selectAll("text.key-label")
            .data(midiRange)
            .enter()
            .append("text")
            .attr("class", "key-label")
            .attr("x", 5)
            .attr("y", d => yScale(d))
            .attr("dy", "0.1em")
            .attr("text-anchor", "start")
            .attr("dominant-baseline", "middle")
            .attr("font-size", "11px")
            .attr("pointer-events", "none")
            .attr("fill", d => {
                const noteIndex = d % 12;
                return noteIndex === 1 || noteIndex === 3 || noteIndex === 6 || noteIndex === 8 || noteIndex === 10 ? whiteKeyColor : blackKeyColor;
            })
            .style("font-variation-settings", "'wdth' 62.5")
            .text(d => `${midiToNoteName(d)} (${d})`);

        gridGroup.selectAll("line.midi-line")
            .data(midiRange)
            .enter()
            .append("line")
            .attr("class", "midi-line")
            .attr("x1", 0)
            .attr("x2", chartWidth)
            .attr("y1", d => yScale(d + 0.5))
            .attr("y2", d => yScale(d + 0.5))
            .attr("stroke", d => (d % 12 === 0) ? darkGridLineColor : lightGridLineColor)
            .attr("stroke-width", 1);

        const timeTicks = xScale.ticks(Math.max(2, Math.floor(chartWidth / 80)));
        gridGroup.selectAll("line.time-line")
            .data(timeTicks)
            .enter()
            .append("line")
            .attr("class", "time-line")
            .attr("x1", d => xScale(d))
            .attr("x2", d => xScale(d))
            .attr("y1", 0)
            .attr("y2", chartHeight)
            .attr("stroke", lightGridLineColor)
            .attr("stroke-width", 1);

        const noteRects = notesGroup.selectAll("rect.note")
            .data(currentNotes.filter(n => n.avgContinuousMidi !== null && n.endTime >= currentViewStart && n.startTime <= currentViewEnd))
            .enter()
            .append("rect")
            .attr("class", "note")
            .attr("x", d => xScale(d.startTime))
            .attr("y", d => yScale(Math.round(d.avgContinuousMidi!) + 0.5))
            .attr("width", d => {
                const startX = xScale(d.startTime);
                const endX = xScale(d.endTime);
                return Math.max(1, endX - startX);
            })
            .attr("height", d => {
                const roundedMidi = Math.round(d.avgContinuousMidi!);
                const noteTopY = yScale(roundedMidi + 0.5);
                const noteBottomY = yScale(roundedMidi - 0.5);
                return Math.max(1, noteBottomY - noteTopY - 1);
            })
            // Dynamic fill based on tuning
            .attr("fill", d => {
                if (d.avgContinuousMidi === null) return "#gray"; // Fallback
                const roundedMidi = Math.round(d.avgContinuousMidi);
                const centsOffset = (d.avgContinuousMidi - roundedMidi) * 100;
                return tuningColorScale(Math.abs(centsOffset));
            })
            // Dynamic stroke based on fill color
            .attr("stroke", d => {
                if (d.avgContinuousMidi === null) return "#darkgray"; // Fallback
                const roundedMidi = Math.round(d.avgContinuousMidi);
                const centsOffset = (d.avgContinuousMidi - roundedMidi) * 100;
                const fillColor = tuningColorScale(Math.abs(centsOffset));
                // Darken the fill color for the stroke
                const darkerColor = d3.color(fillColor)?.darker(0.6);
                return darkerColor ? darkerColor.formatHex() : "#555"; // Provide fallback hex
            })
            .attr("stroke-width", 1)
            .attr("rx", 2)
            .attr("ry", 2)
            // Add mouseover/mouseout for tooltip
            .on("mouseover", function (event: MouseEvent, d: MidiSegment) {
                if (!tooltip || d.avgContinuousMidi === null) return;

                const roundedMidi = Math.round(d.avgContinuousMidi);
                const noteName = midiToNoteName(roundedMidi);
                // Calculate cents offset based on difference between continuous and rounded MIDI
                const centsOffset = Math.round((d.avgContinuousMidi - roundedMidi) * 100);
                const durationSec = (d.duration / 1000).toFixed(2);
                const confidencePercent = (d.avgConfidence * 100).toFixed(0); // Format confidence

                // Format tooltip content
                const content = `
                    <div><strong>Note:</strong> ${noteName} (${roundedMidi})</div>
                    <div><strong>Cents:</strong> ${centsOffset >= 0 ? '+' : ''}${centsOffset}c</div>
                    <div><strong>Conf:</strong> ${confidencePercent}%</div>
                    <div><strong>Duration:</strong> ${durationSec}s</div>
                `;

                tooltip.html(content)
                    .style("opacity", 1)
                    // Position tooltip near the mouse pointer
                    // Adjust offsets (e.g., +15) as needed
                    .style("left", `${event.pageX + 15}px`)
                    .style("top", `${event.pageY + 15}px`);
            })
            .on("mouseout", function () {
                if (tooltip) tooltip.style("opacity", 0);
            });

        // Add tuning lines inside the notes
        notesGroup.selectAll("line.tuning-line")
            .data(currentNotes.filter(n => n.avgContinuousMidi !== null && n.endTime >= currentViewStart && n.startTime <= currentViewEnd))
            .enter()
            .append("line")
            .attr("class", "tuning-line")
            .attr("x1", d => xScale(d.startTime))
            .attr("x2", d => xScale(d.endTime))
            .attr("y1", d => {
                if (d.avgContinuousMidi === null) return 0; // Should not happen due to filter, but safeguard
                const roundedMidi = Math.round(d.avgContinuousMidi);
                const centsOffset = Math.max(-50, Math.min(50, (d.avgContinuousMidi - roundedMidi) * 100)); // Clamp offset
                const noteTopY = yScale(roundedMidi + 0.5);
                const noteBottomY = yScale(roundedMidi - 0.5);
                const centerY = (noteTopY + noteBottomY) / 2;
                const h = noteBottomY - noteTopY;
                const tuningLineY = h > 0 ? centerY - (centsOffset / 50) * (h / 2) : centerY;
                return tuningLineY;
            })
            .attr("y2", d => {
                // Same calculation as y1
                if (d.avgContinuousMidi === null) return 0;
                const roundedMidi = Math.round(d.avgContinuousMidi);
                const centsOffset = Math.max(-50, Math.min(50, (d.avgContinuousMidi - roundedMidi) * 100));
                const noteTopY = yScale(roundedMidi + 0.5);
                const noteBottomY = yScale(roundedMidi - 0.5);
                const centerY = (noteTopY + noteBottomY) / 2;
                const h = noteBottomY - noteTopY;
                const tuningLineY = h > 0 ? centerY - (centsOffset / 50) * (h / 2) : centerY;
                return tuningLineY;
            })
            .attr("stroke", tuningLineColor)
            .attr("stroke-width", 1)
            .attr("pointer-events", "none"); // Prevent line from interfering with tooltip hover

        // --- Note Labels --- (Handles visibility based on width)
        const notesInView = currentNotes.filter(n => n.avgContinuousMidi !== null && n.endTime >= currentViewStart && n.startTime <= currentViewEnd);

        defs.selectAll("clipPath")
            .data(notesInView)
            .enter()
            .append("clipPath")
            .attr("id", d => `clip-${d.startTime}-${Math.round(d.avgContinuousMidi!)}`)
            .append("rect")
            .attr("x", d => xScale(d.startTime))
            .attr("y", d => yScale(Math.round(d.avgContinuousMidi!) + 0.5))
            .attr("width", d => {
                const startX = xScale(d.startTime);
                const endX = xScale(d.endTime);
                return Math.max(1, endX - startX);
            })
            .attr("height", d => {
                const roundedMidi = Math.round(d.avgContinuousMidi!);
                const noteTopY = yScale(roundedMidi + 0.5);
                const noteBottomY = yScale(roundedMidi - 0.5);
                return Math.max(1, noteBottomY - noteTopY - 1);
            });

        notesGroup.selectAll("text.note-label")
            .data(notesInView)
            .enter()
            .append("text")
            .attr("class", "note-label")
            .attr("clip-path", d => `url(#clip-${d.startTime}-${Math.round(d.avgContinuousMidi!)})`)
            .attr("x", d => xScale(d.startTime) + 4)
            .attr("y", d => yScale(Math.round(d.avgContinuousMidi!)))
            .attr("dy", "0.1em")
            .attr("text-anchor", "start")
            .attr("dominant-baseline", "middle")
            .attr("font-size", "12px")
            .attr("fill", "#222222")
            .attr("pointer-events", "none")
            .style("font-variation-settings", "'wdth' 62.5")
            .text(d => midiToNoteName(Math.round(d.avgContinuousMidi!)))
            .each(function (d) {
                const textElement = this as SVGTextElement;
                const noteStartX = xScale(d.startTime);
                const noteEndX = xScale(d.endTime);
                const noteWidth = Math.max(1, noteEndX - noteStartX);
                const padding = 8;
                let textWidth = 0;
                try {
                    textWidth = textElement.getBBox().width;
                } catch (e) {
                    console.warn("Could not get BBox for note label", e);
                }
                d3.select(textElement).style("opacity", noteWidth >= textWidth + padding ? 1 : 0);
            });
    });

    return (
        <svg ref={svgRef} width="100%" height="100%"></svg>
    );
};

export default PianoRoll; 