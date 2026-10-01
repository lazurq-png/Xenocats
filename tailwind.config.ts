import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      gridTemplateColumns: {
        '13': 'repeat(13, minmax(0, 1fr))',
      },
      // Sampled from the Canva mockup ("Xenocat Analytics website mockup").
      colors: {
        void: { DEFAULT: '#070b14', login: '#04051f', landing: '#040a19' },
        panel: { DEFAULT: '#0a0e1c', raised: '#12162b', glass: 'rgba(43, 43, 73, 0.16)' },
        line: '#2d2f47',
        plasma: { DEFAULT: '#c1e838', dim: '#aacf22' },
        aura: { DEFAULT: '#9d86ff', login: '#8c88ff', link: '#7a7ff1' },
        cream: '#e0e0b3',
      },
      fontFamily: {
        display: ['var(--font-display)', 'sans-serif'],
        sans: ['var(--font-sans)', 'sans-serif'],
        ui: ['var(--font-ui)', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 28px -2px rgba(193, 232, 56, 0.55)',
        halo: '0 0 80px -10px rgba(140, 136, 255, 0.55)',
      },
    },
    keyframes: {
      shimmer: {
        '100%': {
          transform: 'translateX(100%)',
        },
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};
export default config;
