# New Machine Setup

No programming knowledge required.

1. Extract the ZIP or clone the project.
2. Double-click `01_START_OMNISUITE.bat` on Windows.
3. The launcher creates `.env` automatically, fills local secrets, and keeps Python packages/caches under `.omnisuite/` inside the project folder.
4. Repair and Big Update checks run inside the Start button automatically.

## Important Notes

- Do not share your `.env` file publicly.
- Do not push `.env` to Git.
- If you want to edit API keys, open `.env` after the first run.

## Troubleshooting

- If something is broken, double-click `01_START_OMNISUITE.bat` again. It will self-repair and retry.
- If image AI dependencies are missing, the repair launcher downloads PyTorch into `.omnisuite/` in this project.
