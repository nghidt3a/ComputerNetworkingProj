# RCS Landing Page

A Soft UI–consistent landing page for Remote Control System (RCS).

## Structure
- landing.html — main page
- styles.css — page-specific styles (reuses ../css/variables.css & soft-ui-base.css)
- main.js — theme toggle, mobile nav, YouTube embed, scroll-reveal

## Configure
- Demo video: edit `YT_URL` in `main.js` (supports youtu.be and watch?v=) or pass via query `?video=<url>`.
- Members (2 ways, sample placeholders ready):
	- Quick: edit the `TEAM_MEMBERS` array in `main.js` (currently filled với Nguyễn Văn A/B/C/D, links & email placeholders).
	- JSON: update `../js/data/team.json` (same placeholders) and the page will auto-load it. You can override source via `?data=/ComputerNetworkingProj/Client/js/data/team.json`.
	- Put images into `../assets/team/` and set relative paths; if missing, a fallback SVG với initials is used.
- Login CTA: points to `../index.html` by default. Override with `?login=/your/path.html` if needed.

## Dark Mode
Click the moon/sun icon to toggle. Preference is saved to localStorage using `data-theme="dark"` which is supported by `variables.css`.

## Preview
Open `landing.html` in a browser. For best results (and to avoid local file fetch constraints), serve via a simple static server:

```bash
# Python 3
python -m http.server 8080
# or Node
npx serve .
```

Then browse to http://localhost:8080/ComputerNetworkingProj/Client/landing/landing.html

Examples with overrides:

```
http://localhost:8080/ComputerNetworkingProj/Client/landing/landing.html?video=https://youtu.be/VIDEO_ID&login=/ComputerNetworkingProj/Client/index.html&data=/ComputerNetworkingProj/Client/js/data/team.json

## Design tokens in use (from ../css/variables.css)
- Colors: `--primary-color: #2563eb`, `--primary-hover: #1d4ed8`, backgrounds `--bg-body: #f8fafc`, cards `--bg-card: #ffffff`, borders `--border-color: #e2e8f0`, text `--text-primary: #0f172a`, `--text-secondary: #64748b`.
- Radius: `--radius-md: 0.5rem`, `--radius-lg: 0.75rem`; Shadows: `--shadow-sm`, `--shadow-md`, `--shadow-card`, `--shadow-hover`.
- Motion: uses `--transition-fast: 0.2s ease`; reveal animation respects `prefers-reduced-motion`.
- Typography: Inter from Google Fonts, weights 300/400/600/800.

## Testing checklist (landing)
- Responsiveness: hero, member grid (1/2/3/4 columns), header sticky + mobile menu toggle.
- Theme: light/dark toggle persists via `localStorage`; colors remain legible in both themes.
- Links/CTAs: Login CTA points correctly; YouTube button opens; data overrides via `?video=`, `?login=`, `?data=` work.
- Media: YouTube iframe loads with correct aspect ratio; member avatars show (fallback initials if missing).
- Accessibility: focus states visible, aria-label on nav toggle/theme toggle, contrast acceptable for primary and text-secondary on bg-body.
```

## Notes
- The page reuses tokens and base components from the app for UI/UX consistency.
- `../assets/team/` is empty by default — add your team photos there. If an image is unavailable, a generated initials avatar will be used automatically.
