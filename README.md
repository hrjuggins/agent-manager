# Workstream Hub

A local web app for managing multiple development workstreams in parallel.

Instead of treating a branch or ticket as the starting point, this hub treats each piece of work as its own **workstream** — a launching point for the tools and context needed to work on it.

## What's a Workstream?

A workstream could be a formal ticket, a prototype, an investigation, a bug fix, or an early-stage idea. Each workstream can include:

- A local repository path
- An optional branch (doesn't need to exist yet)
- An IDE workspace
- An AI coding chat URL
- A localhost browser session
- An optional Linear ticket (displayed read-only)
- An optional pull request (displayed read-only)
- Free-form notes

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Features

- **Create workstreams** — give it a name and start working immediately
- **Quick launch** — open IDE, browser, AI chat, or checkout a branch with one click
- **Status tracking** — mark workstreams as Active or Done
- **Filter view** — see all, active, or completed workstreams
- **External info** — view linked Linear tickets and PRs without them controlling your workflow

## Tech Stack

- [SvelteKit](https://svelte.dev/docs/kit) — full-stack framework
- [TypeScript](https://www.typescriptlang.org/) — type safety
- [Tailwind CSS](https://tailwindcss.com/) — styling
- Node.js adapter — runs as a local server

## Data Storage

Workstream data is stored as JSON in `~/.workstream-hub/workstreams.json`. No database setup required.

## Building for Production

```bash
npm run build
node build
```
