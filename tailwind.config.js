/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./public/index.html", // 指向 CRA 的公共 HTML 文件
    "./src/**/*.{js,jsx,ts,tsx}", // 包含 src 資料夾下的所有 React 檔案
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}