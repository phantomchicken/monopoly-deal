# CLAUDE.md - Monopoly Deal Project Guide

## Overview
A web-based digital implementation of the **Monopoly Deal** card game.
- **Frontend**: Angular 14, Angular Material, Bootstrap 5, RxJS.
- **Backend**: Node.js & Express API (`server.js`).
- **Database**: MongoDB with Mongoose, run via Docker.

---

## Quick Reference / Common Commands

### Frontend (Angular 14)
All commands run from the `monopoly-deal` directory:
- **Dev Server**: `npm start` or `ng serve` (serves on `http://localhost:4200/`)
- **Build**: `npm run build` or `ng build` (outputs to `dist/`)
- **Development Watch Build**: `npm run watch`
- **Unit Tests**: `npm test` or `ng test` (Karma + Jasmine runner)
- **Scaffold Component**: `ng generate component <name>`

### Backend (Express API)
- **Run API Server**: `node server.js` (serves on `http://localhost:3000/`, with endpoints under `/api`)

### Docker & Database (MongoDB)
- **Start Docker Containers**: `docker-compose up -d`
- **Stop Docker Containers**: `docker-compose down`
- **MongoDB Shell**:
  ```bash
  docker exec -it monopoly-deal-mongo-db mongosh
  ```
- **Reset / Clear Cards Collection**:
  ```bash
  docker exec -it monopoly-deal-mongo-db mongosh --eval "use monopoly-deal; db.Cards.deleteMany({});"
  ```
- **Seed Cards into MongoDB**:
  ```bash
  docker cp ./src/assets/cards.json monopoly-deal-mongo-db:/cards.json
  docker exec -it monopoly-deal-mongo-db mongoimport --db monopoly-deal --collection Cards --mode upsert --upsertFields make --jsonArray --file cards.json
  docker exec -it monopoly-deal-mongo-db rm -rf cards.json
  ```

---

## Project Structure

```
monopoly-deal/
├── docker-compose.yml          # Container configuration for Node API & MongoDB
├── server.js                   # Express backend server entry point (port 3000)
├── package.json                # Project dependencies and npm scripts
├── angular.json                # Angular CLI workspace configuration
├── .claude/                    # Claude Code configuration & environment settings
│   ├── settings.json
│   └── CLAUDE.md
└── src/
    ├── api/                    # Express backend source
    │   ├── controllers/cards.js# Card endpoint controllers
    │   ├── models/db.js        # Mongoose connection setup (mongodb://mongo-db:27017 or localhost)
    │   ├── models/cards.js     # Mongoose card schema
    │   └── routes/db.js        # API routes (/api/cards, /api/card/:idCard, etc.)
    ├── app/                    # Angular frontend source
    │   ├── cards/              # Card display and rendering components
    │   ├── classes/            # Domain models (Card, Game, Player, Set)
    │   ├── play/               # Table/play arena component
    │   ├── template/           # Layout components (navbar, sidebar, templates)
    │   ├── card.service.ts     # Card API data service
    │   ├── game.service.ts     # Core game logic, rules engine, turns & state
    │   ├── color-rent-map.ts   # Property set definitions, color maps & rent rules
    │   ├── app.module.ts       # Main Angular module declarations
    │   └── app-routing.module.ts
    ├── assets/                 # Card textures, images, and card seed data
    │   ├── cards.json          # Card data definitions used for MongoDB seeding
    │   └── sets.json           # Monopoly set rules and configurations
    └── environments/           # Environment configs (apiUrl: http://localhost:3000/api)
```

---

## Architecture & Code Conventions

1. **Angular & TypeScript**:
   - Angular 14 service-based state architecture.
   - Core game engine and player turn mechanics reside in [game.service.ts](file:///c:/Users/Administrator/Documents/Monopoly%20Deal/monopoly-deal/src/app/game.service.ts).
   - Card operations and HTTP communication handled by [card.service.ts](file:///c:/Users/Administrator/Documents/Monopoly%20Deal/monopoly-deal/src/app/card.service.ts).
   - Strict typing using domain models in `src/app/classes/`.

2. **Backend API**:
   - Modular Express routes under `src/api/routes/db.js`.
   - Mongoose data models under `src/api/models/`.
   - RESTful endpoints:
     - `GET /api/cards`: Retrieve all cards
     - `POST /api/card`: Add card
     - `GET /api/card/:idCard`: Retrieve single card
     - `PUT /api/card/:idCard`: Update card
     - `DELETE /api/card/:idCard`: Delete card

3. **Styling & Assets**:
   - UI blends Angular Material, Bootstrap 5, and custom card CSS.
   - Card images are located in `src/assets/` named corresponding to card properties.

