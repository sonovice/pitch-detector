/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./index.html", // Include the main HTML file in the root
        "./src/**/*.{js,ts,jsx,tsx}" // Make sure this covers your component files
    ],
    theme: {
        extend: {
            fontFamily: {
                // Add Noto Sans, making it the default sans-serif font
                sans: ['"Noto Sans"', 'sans-serif'],
            },
        },
    },
    plugins: [],
} 