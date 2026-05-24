# New Machine Setup (2 minutes)

No programming knowledge required, just follow these 3 steps:

1. Create the `.env` file from `.env.example`
- On Windows: copy `.env.example` and rename the copy to `.env`.

2. Open `.env` and add this line (or edit it if it already exists):
`INTERNAL_TOKEN=abc123_xyz_2026_private`

3. Run the project as usual.

## Important Notes
- `INTERNAL_TOKEN` is a custom token you define (completely free).
- Do not share this token publicly.
- Do not push your `.env` file to Git.

## Troubleshooting
- If you see "Missing INTERNAL_TOKEN environment variable":
  Double check that your `.env` file exists and contains the line `INTERNAL_TOKEN=...`.
