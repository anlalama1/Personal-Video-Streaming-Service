import tokens from '../tokens/design-tokens.json';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        heritage: {
          black: tokens.colors['heritage-black'],
          900: tokens.colors['stone-900'],
          800: tokens.colors['stone-800'],
          400: tokens.colors['stone-400'],
          gold: tokens.colors['amber-500'],
          sunset: tokens.colors['orange-600'],
          parchment: tokens.colors['parchment'],
        }
      }
    },
  },
  plugins: [],
}
