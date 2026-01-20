/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      height: {
        'screen': '100dvh',
      },
      minHeight: {
        'screen': '100dvh',
      },
      maxHeight: {
        'screen': '100dvh',
      },
    },
  },
  plugins: [],
};
