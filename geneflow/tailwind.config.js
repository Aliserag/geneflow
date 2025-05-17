module.exports = {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2563eb', // blue-600
          light: '#3b82f6', // blue-500
          dark: '#1e40af', // blue-800
        },
        secondary: {
          DEFAULT: '#14b8a6', // teal-500
          light: '#5eead4', // teal-300
          dark: '#0f766e', // teal-800
        },
        accent: {
          DEFAULT: '#10b981', // emerald-500
          light: '#6ee7b7', // emerald-300
          dark: '#047857', // emerald-800
        },
        neutral: {
          DEFAULT: '#f9fafb', // gray-50
          dark: '#111827', // gray-900
          mid: '#6b7280', // gray-500
        },
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'Arial', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'monospace'],
      },
    },
  },
  plugins: [],
}; 