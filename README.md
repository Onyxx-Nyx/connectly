# Connectly

A social network front-end built with plain HTML, CSS and JavaScript. It is a learning and portfolio project: a feed where you can sign up, post updates with photos, like, comment and add friends. Everything runs in the browser and is saved in `localStorage`, so there is no backend to set up.

Connectly is an original design. It takes the general idea of a social feed, not the branding or code of any existing product.

## Features

- Sign up and log in (front-end demo, see the note below)
- Look around as a guest with one click
- Write posts with up to 500 characters and an optional photo
- Photos are resized in the browser before saving
- Like and unlike posts
- Comment on posts
- Delete your own posts
- Filter the feed: Home, My posts, Posts I liked
- Search posts and people
- Friend suggestions with Add friend / Requested
- Responsive layout for phones, tablets and desktops
- Keyboard accessible, with visible focus and screen reader labels

## Run it

No build step. Open `index.html` in a browser.

Or serve the folder locally:

```bash
python3 -m http.server 8000
```

Then visit http://localhost:8000.

## Project structure

```
connectly/
├── index.html   # page structure for the log in screen and the app
├── style.css    # all styles, with design tokens at the top
├── script.js    # app logic, state and rendering
└── README.md
```

## Important note about accounts

This project has no server. Accounts live in your browser's `localStorage`, and the password field is only checked for length and is never stored. Do not use a real password.

Built by Onyxx_Nyx
