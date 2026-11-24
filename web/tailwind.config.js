const scale = (name) =>
  Object.fromEntries(
    [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((n) => [
      n,
      `rgb(var(--${name}-${n}) / <alpha-value>)`,
    ]),
  );

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    fontSize: {
      sm: '0.750rem',
      base: '1rem',
      xl: '1.333rem',
      '2xl': '1.777rem',
      '3xl': '2.369rem',
      '4xl': '3.158rem',
      '5xl': '4.210rem',
    },
    fontFamily: {
      heading: ['"IBM Plex Sans Thai"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      body: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
    },
    fontWeight: { normal: '400', bold: '700' },
    extend: {
      colors: {
        text: scale('text'),
        background: scale('background'),
        primary: scale('primary'),
        secondary: scale('secondary'),
        accent: scale('accent'),
      },
    },
  },
  plugins: [],
};
