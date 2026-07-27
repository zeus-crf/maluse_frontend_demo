/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,ts,scss}"],
  theme: {
    extend: {
      colors: {
        "primary":               "#003ec7",
        "primary-container":     "#0052ff",
        "on-primary":            "#ffffff",
        "secondary":             "#5c5f60",
        "on-surface":            "#141b2b",
        "on-surface-variant":    "#434656",
        "surface-container":     "#e9edff",
        "outline":               "#737688",
        "outline-variant":       "#c3c5d9",
        "on-secondary-container":"#606365",
      },
      fontFamily: {
        sans:    ["Inter", "sans-serif"],
        heading: ["Geist", "sans-serif"],
      },
    },
  },
  plugins: [
    function ({ addUtilities }) {
      addUtilities([
        { '.scrollbar-hide': { '-ms-overflow-style': 'none', 'scrollbar-width': 'none' } },
        { '.scrollbar-hide::-webkit-scrollbar': { 'display': 'none' } },
      ]);
    },
  ],
}
