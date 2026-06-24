# 💝 Love Website

## Folder structure
```
love-website/
├── index.html
├── style.css
├── app.js
├── music/
│   └── music.mp3   ← add your own MP3 here
├── pictures/       ← memory-circle photos go here
│   └── howluckyiam/   ← 8 ordered images (1.jpeg … 8.jpeg) for the "How Lucky I Am" page
├── videos/         ← memory-card videos (.mp4) go here
└── README.md
```

## How to run

### Option A — Quick preview (no music)
Double-click `index.html` — opens directly in your browser.

### Option B — With music (recommended)
Use a local server so the browser can load the audio file.

**VS Code (easiest):**
1. Install the "Live Server" extension
2. Right-click `index.html` → Open with Live Server

**Python:**
```bash
cd love-website
python -m http.server 8080
```
Then open → http://localhost:8080

**Node.js:**
```bash
npx serve .
```

## How to customise

| What              | Where in app.js          |
|-------------------|--------------------------|
| Opening text      | `IndexPage` component    |
| Quotes            | `QUOTES` array           |
| Memory cards      | `MEMORIES` array         |
| Reason cards      | `REASONS` array          |
| "How Lucky I Am"  | `HOWLUCKY` list + `HOWLUCKY_SENTENCE` |
| Footer name       | `MainPage` footer section|
| Colours/gradients | style.css                |

### "How Lucky I Am" page
A click-to-reveal page: it shows one image at a time, and **each click reveals the
next**. After the last one, all images line up and the full sentence is shown.
Edit the `HOWLUCKY` array (image paths, in reveal order) and `HOWLUCKY_SENTENCE`
(the text shown on the final screen) in `app.js`. Images live in
`pictures/howluckyiam/` named `1.jpeg … 8.jpeg`.

### Memory photos, videos & dates
Each entry in the `MEMORIES` array (in `app.js`) has three optional fields:

| Field      | What it does | Example |
|------------|--------------|---------|
| `photo`    | Shows a real photo in the circle (replaces the emoji). Click it to enlarge. | `photo: "pictures/first-date.jpg"` |
| `video`    | Adds a **▶ Watch video** button that opens the clip in a popup. | `video: "videos/first-date.mp4"` |
| `realDate` | The small date badge on the card. | `realDate: "February 14, 2023"` |

**How to add media:** drop your image in `pictures/` and your `.mp4` in `videos/`,
then set the matching field to its path. Leave a field as `""` to skip it — an
empty `photo` just shows the emoji, an empty `video` shows no button. If a photo
file is missing, the circle automatically falls back to the emoji.
Replace the `/* EDIT */` placeholder dates with your real ones.

## Deploy online (free)
- **Netlify Drop:** go to netlify.com/drop and drag the whole folder
- **GitHub Pages:** push to a repo and enable Pages in Settings
