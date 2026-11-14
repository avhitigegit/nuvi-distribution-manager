# NUVI Social Media Distribution Manager

A Chrome extension that keeps NUVI's Facebook groups in one place and guides you,
group by group, through sharing each advertisement. You always do the final
posting yourself.

## Folders

| Folder | What it is |
|---|---|
| `doc/` | BRD, Technical Document, System Architecture, and the **Implementation Plan** |
| `prototype/` | Clickable prototype (open `prototype/index.html`) |
| `client/` | **Frontend**: the real Chrome extension (HTML + CSS + JavaScript) |
| `server/` | **Backend**: Supabase SQL files (database tables + security) |

## Tech stack (all free)

- **Frontend:** Chrome extension (Manifest V3), plain HTML + CSS + JavaScript
- **Backend:** Supabase (login + PostgreSQL database + auto API). No Node.js server
- **Code:** GitHub (private repo)

## Progress

See [`doc/IMPLEMENTATION_PLAN.md`](doc/IMPLEMENTATION_PLAN.md).

## How updates go live
Push to `main` → GitHub Actions **Deploy website** publishes `client/` to Cloudflare
(about 1 minute) → open pages show a **Reload now** bar. Live site:
https://nuvi-distribution-manager.nuviengineering.workers.dev/
