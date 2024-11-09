/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  theme: {
    extend: {
      colors: {
        golden: {
          DEFAULT: "#fbbf24", // golden
        },

        blue: {
          DEFAULT: "#111827", // hard blue
          light: "#374151", // soft blue
          medium: "#202a37", // medium blue
        },

        /* GREY */
        grey: {
          100: "#FCFDFD",
          200: "#E5E5E5",
          300: "#BFBFBF",
          400: "#999999",
          DEFAULT: "#4D4D4D", // 900
        },

        black: "#121112",
        white: "#FFFFFF",
        border: "#374151",
      },
    },
    minHeight: {
      96: "24rem", // 384px
      52: "13rem", // 208px
      36: "9rem", // 144px
      screen: "100vh", // 100vh
    },
    minWidth: {
      96: "24rem", // 384px
      32: "8rem", // 128px
      screen: "100vw", // 100vw
    },
  },
  plugins: [],
};
