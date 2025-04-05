# Pitch Detector

A web application built with SolidJS and TensorFlow.js to detect musical pitch in real-time from microphone input and visualize it.

## Features

*   Real-time pitch detection from microphone audio stream.
*   Identification of musical note (name, octave, MIDI number) from detected pitch.
*   Display of detection confidence level.
*   Visualization of pitch history on a piano roll.
*   Segmentation of detected notes based on pitch stability and duration.
*   Pause/Resume functionality for analysis.

## Technologies Used

*   **Framework:** SolidJS
*   **Build Tool:** Vite
*   **Language:** TypeScript
*   **Styling:** Tailwind CSS
*   **Pitch Detection Model:** TensorFlow.js (via custom PitchDetectionService)
*   **Visualization:** Custom components ( using d3.js)
*   **Routing:** @solidjs/router
*   **Package Manager:** Bun

## Installation

1.  **Clone the repository:**
    ```bash
    git clone <your-repository-url> # Replace with your repo URL
    cd pitch-detector
    ```
2.  **Install dependencies using Bun:**
    ```bash
    bun install
    ```

## Usage

*   **Development:** Start the development server with hot-reloading:
    ```bash
    bun run dev
    ```
*   **Build:** Create a production-ready build in the `dist` folder:
    ```bash
    bun run build
    ```
*   **Preview Build:** Serve the production build locally:
    ```bash
    bun run serve
    ```

## Deployment

This project is automatically deployed to GitHub Pages whenever changes are pushed to the `main` branch. The deployment process is handled by the GitHub Actions workflow defined in `.github/workflows/deploy.yml`.