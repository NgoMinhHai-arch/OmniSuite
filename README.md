# OmniSuite AI - All-in-One SEO & Marketing Intelligence Hub

**OmniSuite AI** is a comprehensive ecosystem designed to automate data analysis, keyword research, and website performance optimization through advanced Artificial Intelligence.

## Key Features

### SEO Intelligence
*   **Page Analyzer:** Deep analysis of on-page SEO, header structures, and keyword density.
*   **Bulk Metrics:** Rapidly gather Volume, CPC, and Keyword Difficulty for large lists.
*   **Competitor Gap:** Identify strategic keyword opportunities compared to competitors.

### AI-Driven Insights
*   **Smart Intent Engine:** Automatically classify Search Intent using multi-modal AI models.
*   **AI Integration:** Seamless connection with Gemini, OpenAI, Claude, and Groq.
*   **Auto-Discovery:** Intelligent model selection based on task requirements.

### Advanced Scraping
*   **Stealth Mode:** Robust data mining using Puppeteer Stealth & Playwright to bypass bot detection.
*   **Python Core:** High-performance Python backend for complex data processing.
*   **Universal Parsing:** Extract data from PDF, DOCX, and XLSX files effortlessly.

### Professional Dashboard
*   **Interactive UI:** High-performance visualizations for quick ROI identification.
*   **Keyword Hub:** Centralized storage with smart caching for efficient data management.

---

## Tech Stack

| Component | Technology |
| :--- | :--- |
| **Frontend** | [Next.js 16 (App Router)](https://nextjs.org), React 19, Tailwind CSS 4 |
| **UI/UX** | Framer Motion (Animations), Lucide React (Icons) |
| **AI SDK** | [Vercel AI SDK](https://sdk.vercel.ai/docs), Google Generative AI, OpenAI |
| **Backend** | Python (FastAPI), Puppeteer Stealth, Playwright |
| **Data Engine** | SQLite, Cheerio, Mammoth (DOCX), PDF-Parse |

---

## Project Structure

*   `src/app/api/`: Route Handlers for AI & Backend integration.
*   `src/components/features/`: Core functional modules (BulkMetrics, Analyzer, etc.).
*   `scripts/`: Python core scrapers and data processing utilities.

---

## Getting Started

### Quick Start - Just 1 Click!

#### Option 1: Using Launcher (Recommended)
**Requirements:** Node.js 18+ and Python 3.10+ installed

1. **Run directly:**
   ```bash
   node launcher.js
   ```
   Or: `npm run app`

2. **Build .exe file (one-click run):**
   ```bash
   npm run build:exe
   ```
   Then **double-click** `OmniSuite.exe` to run

#### Option 2: Manual Setup
1. Install dependencies:
   ```bash
   npm install
   pip install -r requirements.txt
   ```
2. Create `.env` file from `.env.example`
3. Run: `npm run dev`

### Useful Commands
| Command | Description |
|---------|-------------|
| `npm run app` | Run app using launcher |
| `npm run build:exe` | Build OmniSuite.exe file |
| `npm run dev` | Run dev mode (frontend + backend) |
| `npm run dev:next` | Run Next.js only |
| `npm run dev:engine` | Run Python backend only |
| `npm run security:scan` | Scan tracked files for obvious secrets before push |
| `npm run security:scan:staged` | Scan staged diff for secrets before commit |
| `npm run security:install-hooks` | Install local pre-commit/pre-push security hooks |

### System Requirements
*   **Node.js 18+** - [Download here](https://nodejs.org/)
*   **Python 3.10+** - [Download here](https://www.python.org/downloads/)
*   **API Keys** - Add to `.env` file (Gemini, OpenAI, etc.)

### Security Before GitHub Push
1. Copy `.env.example` to `.env` and fill local secrets only on your machine.
2. Never commit `.env` (already ignored by `.gitignore`).
3. Run `npm run security:install-hooks` once per clone.
4. Run `npm run security:scan` before each push (CI also enforces this via GitHub Actions).

---

*Developed and maintained by NgoMinhHai.*

**Note:** `OmniSuite.exe` is not included in the GitHub repository. After cloning, run `npm run build:exe` to create your own executable.
