# NutriScan – AI-Powered Nutrition Analyzer

NutriScan is an AI-assisted nutrition analysis application built with React and Tailwind CSS. It helps users scan labels, analyze nutrient data, set goals, and interact with an intelligent nutrition assistant — all in a simple, modern interface.

##  Features

**Nutrition Analyzer** – Scan or manually enter nutrition data for instant insights.

**Goal Setup Wizard** – Collects user metrics (age, weight, height) to personalize recommendations.

**Activity Logs** – Saves user scans and previous analyses.

**NutriBot AI** – Chat-based nutrition assistant for quick guidance.

**Responsive UI** – Built using React and Tailwind for a clean, smooth experience.

## Tech Stack

React.js

Tailwind CSS (v3 — CRA compatible)

JavaScript (ES6+)

Firebase (optional: logs, storage, authentication)

## Installation

## Clone the repository:

git clone https://github.com/your-username/NutriScan.git
cd NutriScan


## Install dependencies:

npm install


## Start the development server:

npm start


## Project runs at:
👉 http://localhost:3000

## Configuration
Tailwind Setup

postcss.config.js

module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};


## index.css

@tailwind base;
@tailwind components;
@tailwind utilities;

## 📁 Project Structure
src/
│── components/
│── pages/
│── firebaseConfig.js
│── App.js
│── index.js
│── index.css
tailwind.config.js
postcss.config.js
package.json

## Future Enhancements

AI-based food recommendations

PWA mode (offline support + mobile app experience)

Image-based portion detection

## Contributing

Contributions, issues, and feature requests are welcome.
Feel free to open a PR or create an issue.

## License

This project is licensed under the MIT License.
