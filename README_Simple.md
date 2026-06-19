# OmniSuite AI - Simple Guide

## What is included

Whether you download a ZIP or use `git clone`, the OmniSuite repository gives you the app itself.

The core runtime is:

`Next.js UI -> Next API -> Python FastAPI :8082`

This core path powers:

- SEO tools
- Keywords
- Content generation
- Jobs / queues
- AI Butler in-app features

## What is optional

These are not required to run the OmniSuite core:

- Legacy interpreter `:8081`
- Image / CLIP service `:8000`
- OpenManus
- browser-use
- Crawl4AI
- JobOps
- other integrations under `integrations/`

So:

- Core SEO + AI Butler do not require OpenManus/browser-use/JobOps
- `/run`, `/run-browser`, and similar integration workflows require extra downloads

## Quick start

1. Download ZIP or clone the project.
2. Open the project folder.
3. Double-click `01_START_OMNISUITE.bat`.

If something is broken, double-click `01_START_OMNISUITE.bat` again. It will self-repair and retry.

Big Update checks are built into the Start button, so users do not need a separate repair/update button.

For the core only, the important services are:

- Next.js app
- Python FastAPI on `8082`

## Integrations note

OpenManus, browser-use, JobOps, and similar packages are optional downloads. They are not part of the core runtime and may need Git plus network access when you choose to use them.
