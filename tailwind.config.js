/** @type {import('tailwindcss').Config} */
export default {
    content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
    theme: {
        extend: {
            // FIX: Using `extend` instead of top-level `colors` so that
            // Tailwind's default palette (gray, slate, red, blue, etc.) is
            // preserved. The previous `theme.colors` was replacing ALL defaults.
            colors: {
                primary: "#FF6B00",
                secondary: "#00A3A3",
                tertiary: "#049EFF",
                neutral: "#333333",
            },
            fontFamily: {
                sans: ["Inter", "sans-serif"],
            },
        },
    },
    plugins: [],
};

