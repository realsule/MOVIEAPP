# Flatadango
One-line: A simple movie ticketing frontend.

## Live demo
https://your-site.netlify.app

## Run locally
1. Install json-server
2. `json-server --watch db.json --port 3000`
3. Open index.html in browser

## Features
- Browse films
- Buy tickets (PATCH + POST)
- Delete films (DELETE)

## Tech
HTML, CSS, vanilla JS (fetch), json-server

## Rubric
- DOM: dynamic render
- Events: click handlers
- Server: GET, PATCH, POST, DELETE




 ## Movie App Frontend (HTML / CSS / JS)

## What you have
This project is a self-contained front-end demo for a professional movie booking app. It uses a local `db.json` file (to be served via `json-server`) and a pure HTML/CSS/JS frontend.

## Files
- `index.html` — main UI
- `styles.css` — modern, responsive styles
- `app.js` — application logic (fetching, rendering, booking)
- `db.json` — local dataset

## Run locally
1. Create a folder and split the sections above into files with the same names.
2. Install json-server globally if you haven't: `npm install -g json-server`.
3. Start the fake API server: `json-server --watch db.json --port 3000`.
4. Start a local static server (or open `index.html` via Live Server extension or):
   - `npx serve .` or `python3 -m http.server 5000`
5. Open http://localhost:5000 (or whichever port) and the UI should load and communicate with the fake API.

## Notes & Next steps
- The app uses optimistic UI updates for booking and patches `showtimes` on the movie resource.
- For production you should add authentication and move persistence to a real DB.
- Enhancements: seat-map visual UI, user accounts, booking history, payment integration, and trailer preloading.
