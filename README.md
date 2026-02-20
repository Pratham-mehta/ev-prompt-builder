# EV GIS Prospector

An AI-powered EV charging site prospecting tool built with React, Vite, and Google Gemini.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- npm (comes with Node.js)
- A Google Gemini API key — contact [pratham.m@locomexgroup.com](mailto:pratham.m@locomexgroup.com) to get access

## Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/Pratham-mehta/ev-prompt-builder.git
   cd ev-prompt-builder
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   Copy the example env file and add your API key:

   ```bash
   cp .env.example .env
   ```

   Then open `.env` and replace the placeholder with your actual key:

   ```
   VITE_GEMINI_API_KEY=your_gemini_api_key_here
   ```

   > To get a Gemini API key, contact [pratham.m@locomexgroup.com](mailto:pratham.m@locomexgroup.com)

## Running Locally

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## Build for Production

```bash
npm run build
```

The output will be in the `dist/` folder.

## Tech Stack

- [React](https://react.dev/) — UI framework
- [Vite](https://vitejs.dev/) — Build tool
- [Leaflet](https://leafletjs.com/) — Interactive maps
- [Google Gemini](https://ai.google.dev/) — AI-powered site analysis
- [Lucide React](https://lucide.dev/) — Icons
