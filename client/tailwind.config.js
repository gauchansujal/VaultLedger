/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        vault: {
          bg: '#0F1417',
          surface: '#171D21',
          surface2: '#1E252A',
          border: '#2A3339',
          gold: '#C9A227',
          goldMuted: '#8A7222',
          teal: '#3FA796',
          danger: '#E5484D',
          text: '#EDEFF1',
          textMuted: '#8B95A1',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'sans-serif'],
        body: ['var(--font-body)', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      borderRadius: {
        vault: '10px',
      },
    },
  },
  plugins: [],
};
