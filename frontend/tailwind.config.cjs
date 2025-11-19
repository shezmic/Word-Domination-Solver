/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: 'class',
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: '#2196f3',
                secondary: '#4caf50',
                danger: '#f44336',
                bg: '#fafafa',
                'card-bg': '#ffffff',
                'text-primary': '#212121',
                'text-secondary': '#757575',
            }
        },
    },
    plugins: [],
}
