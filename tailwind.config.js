import typography from '@tailwindcss/typography';
import { 
  themeColors, 
  themeFonts, 
  themeTextColors, 
  themeBorderColors, 
  themeBackgroundColors 
} from './src/utils/theme.js';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: themeColors,
      textColor: themeTextColors,
      borderColor: themeBorderColors,
      backgroundColor: themeBackgroundColors,
      fontFamily: themeFonts,
    },
  },
  plugins: [
    typography,
  ],
}
