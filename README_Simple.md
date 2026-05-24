# OmniSuite AI — Simple Guide

## Important: integrations are not bundled

**Whether you use a GitHub ZIP or `git clone`, you only get the OmniSuite app shell** (UI, SEO tools, AI Butler chat).

Packages such as **OpenManus**, **browser-use**, **JobOps**, **Crawl4AI**, **resume-lm**, etc. are **not included**. You download **each one when you need it**.

| How you get OmniSuite | OpenManus / JobOps / … included? |
|------------------------|----------------------------------|
| **Download ZIP** | **No** (`integrations/` folders are empty) |
| **`git clone`** (recommended) | **Also no** — easier to fetch each package later |

**SEO app + AI Butler chat** work after `npm install`. **`/run`, `/run-browser`, JobOps, etc.** only work after **you fetch or clone** those packages (requires **Git** + network).

### Avoid ZIP if you can

ZIP is worse than clone: GitHub does **not** pack submodule code into the archive. With clone you still fetch integrations yourself, but you can use `npm run integrations:fetch` and first-time `/run` auto-download.

**Already downloaded a ZIP?** Pick one:

1. **Re-clone with Git** (easiest): delete the folder → `git clone https://github.com/NgoMinhHai-arch/OmniSuite.git`
2. **Keep the ZIP folder**, install [Git](https://git-scm.com/), open PowerShell in the OmniSuite folder:
   ```
   npm run integrations:fetch -- open_manus
   npm run integrations:fetch -- browser_use
   ```
3. In **AI Butler** (`/dashboard/ai-support`): first `/run` or `/run-browser` **auto-downloads** that package (Git + network required).

Type **`/tai-bang`** in AI Butler to see what is **downloaded** vs **not downloaded** on your machine.

---

## How to run (no coding required)

### 1. Download (use `git clone` — not ZIP)

Open Command Prompt or PowerShell:

```
git clone https://github.com/NgoMinhHai-arch/OmniSuite.git
cd OmniSuite
npm install
```

Do **not** use “Download ZIP” on GitHub (integration folders will be empty).

After `git clone` + `npm install`: OpenManus, JobOps, browser-use, etc. are **still not on disk** — use **`/tai-bang`** in AI Butler or:

```
npm run integrations:fetch -- <package_id>
```

First **`/run`** or **`/run-browser`** can **auto-download** one runner package (Git required on Windows).

### 2. Run

Go to the project folder → double-click **`01_START_OMNISUITE.bat`**

### 3. Configuration (first time)

- The browser opens automatically
- Open **Settings** (gear icon)
- Enter API keys (OpenAI, Gemini, etc.)
- Save

### 4. Start using

For questions, use your IDE assistant or the docs in the main [README.md](README.md).

---

## AI Butler — download packages (cheat sheet)

Open **`/dashboard/ai-support`** (AI Butler).

| Command | What it does |
|---------|----------------|
| `/tai-bang` | Table: downloaded vs not downloaded |
| `/tai` | How to fetch each package |
| `/integrations` | Full list + GitHub links |
| `/run` | Auto-fetch OpenManus on first use |
| `/run-browser` | Auto-fetch browser-use on first use |

Manual fetch (PowerShell in OmniSuite folder):

```
npm run integrations:fetch -- <package_id>
```

Examples: `open_manus`, `browser_use`, `crawl4ai`, `activepieces`  
List all fetchable IDs: `npm run integrations:fetch -- --list`

---

## Delete

Delete the project folder to remove everything (no extra uninstaller).

---

## API keys

- OpenAI: https://platform.openai.com/api-keys  
- Gemini: https://aistudio.google.com/app/apikey  
- SerpAPI: https://serpapi.com/manage-api-key  
