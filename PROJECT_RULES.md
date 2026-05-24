<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# 📜 PROJECT RULES & FUNCTIONAL DESCRIPTIONS (FOR AI)

> **Note:** This is the rules file for the AI (Antigravity) to read whenever starting work. The rules defined here have the highest priority, helping me understand your style and avoid unnecessary mistakes.

## 0. Overview & Modular Architecture
The project adheres to the **Feature-Sliced Design (FSD)** architecture to ensure scalability and ease of maintenance:
- **`src/modules/`**: Contains self-contained feature modules (SEO, Maps, Images, Affiliate). Each module contains its own components and services.
- **`src/shared/`**: Contains shared elements (`ui`, `lib`, `types`, `utils`) used across the entire project.
- **`python-engine/`**: Independent Python Backend (FastAPI). This is the "brain" that handles all heavy logic (Scraping, AI, Data processing).
- **`src/app/api/`**: Next.js API/BFF layer. Serves strictly as a Proxy/Wrapper calling the Python Engine, containing no manual script logic.

## 1. Coding Style
- Optimize code based on the existing Modular architecture.
- **Import Rules**: Always prioritize using the alias `@/` (e.g., `@/shared/ui/Button`, `@/modules/seo/services/seo_service`). Absolutely avoid deep relative imports (`../../../../`).
- **API Efficiency**: Always optimize the number of tokens used and the frequency of calling AI APIs.

## 2. Design & UI Rules
- Use the Design System in `src/shared/ui/`. Do not create separate UI components if a shared one already exists.
- Ensure consistency in colors, font sizes, and interactive effects throughout the entire Dashboard.

## 3. Python Engine (FastAPI) Operation Rules
- **Port**: Fixed to port **8000**.
- **Async First**: You must use `playwright.async_api` and `async/await` for all routers to avoid blocking the Event Loop.
- **Security Model**: Server-to-Server communication only. Next.js calls Python through the internal network. Do not open CORS for browsers.
- **Key Management**: All API Keys (OpenAI, Gemini...) must reside in `python-engine/.env`. The Frontend is not allowed to store Keys.

## 4. Schema & Logic Requirements
- **Schema Driven**: All Python routers must specify a `response_model` (Pydantic). Do not return anonymous dict data.
- **Dumb Routers**: Python routers only receive requests and call services. Practical logic must reside in `services/`.
- **Pure Functions**: Functions in `services/` must not import FastAPI libraries (such as Request, HTTPException).

## 6. Quality Control & AI Automation (MANDATORY)
To ensure the AI operates autonomously, fixes its own errors, and keeps the project clean, Antigravity must comply with:
- **"Red to Fix, Green to Submit" Rule**: All Python logic changes must be verified using **Pytest**. Report "Passed" results before completing a task.
- **2026 Code Standards**: Use **Ruff** for code linting and formatting. Do not leave errors like "Multiple statements on one line" or "unused imports". Keep the system consistent. System configurations (like API keys) that require user input must always be displayed in the system settings.
- **Context Cleanup**: Regularly run **Vulture** to detect and remove dead code/files to avoid cluttering the AI source code reading context.
- **Structural Integrity**: Use **Dependency Cruiser** to check the dependency tree and ensure that modular rules are not violated (e.g., Module A must not call Module B directly without going through the Shared layer).

## 7. General Rules
1. Do not invent requirements. Do exactly what you are assigned.
2. If anything is unclear, ask for clarification immediately.
3. Leverage external AI support (Claude/GPT) to solve difficult problems, but optimize the code to align with the project's style.
4. Always double-check your code with `npm run build` after editing to ensure there are no import errors.
5. Before submitting your work, run the testing toolset: `pytest`, `ruff`, `vulture`.
6. Before making major structural changes, summarize the plan and wait for approval.
7. Always create a demo file to test before applying changes to the main project. Ensure "Never broken".

## 8. Fast & Safe GitHub Update Process (MANDATORY)
1. Never commit `.env` or files containing actual production secrets.
2. Always run security scans before pushing code:
   - `npm run security:scan`
   - Or use the grouped command: `npm run ship -- "commit message"`
3. Use `npm run ship` by default for the fast pipeline: scan -> add -> commit -> push.
4. If push fails due to GitHub permissions/token issues, resolve auth first and then push; do not turn off the scanner.
5. Only commit changes related to the task scope, avoiding unrelated files (especially submodule/integrations files).
6. The creator of this project does not know how to code. Verify all changes carefully and make sure there are no bugs (double check everything).
