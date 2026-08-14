/** @type {import('tailwindcss').Config} */
export default {
    content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
    theme: {
        colors: {
            primary: "#FF6B00",
            secondary: "#00A3A3",
            tertiary: "#049EFF",
            white: "#FFFFFF",
            neutral: "#333333",
        },
        fontFamily: {
            sans: ["Inter", "sans-serif"],
        },
        extend: {},
    },
    plugins: [],
};
