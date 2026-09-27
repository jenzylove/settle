// Shared look for the app, the landing page and the results page: monotone,
// full width, hairlines instead of boxes.
export const FONTS = `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2064%2064%22%3E%3Crect%20width%3D%2264%22%20height%3D%2264%22%20rx%3D%2216%22%20fill%3D%22%232f5bff%22/%3E%3Ctext%20x%3D%2232%22%20y%3D%2246%22%20text-anchor%3D%22middle%22%20font-family%3D%22Georgia%2C%20%27Times%20New%20Roman%27%2C%20serif%22%20font-style%3D%22italic%22%20font-size%3D%2242%22%20fill%3D%22%23ffffff%22%3ES%3C/text%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">`;

export const BASE_CSS = `
:root {
  --bg: #ffffff; --fg: #0b0b0c; --muted: #6b6b70; --faint: #a1a1a6; --line: #e4e4e7; --soft: #f5f5f6; --strong: #0b0b0c;
  --sans: "Inter Tight", ui-sans-serif, system-ui, sans-serif; --mono: "JetBrains Mono", ui-monospace, monospace;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { --bg: #0b0b0c; --fg: #f4f4f5; --muted: #9a9aa2; --faint: #5c5c62; --line: #26262b; --soft: #141417; --strong: #f4f4f5; }
}
:root[data-theme="dark"] { --bg: #0b0b0c; --fg: #f4f4f5; --muted: #9a9aa2; --faint: #5c5c62; --line: #26262b; --soft: #141417; --strong: #f4f4f5; }
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body { margin: 0; background: var(--bg); color: var(--fg); font: 16px/1.55 var(--sans); -webkit-font-smoothing: antialiased; }
a { color: inherit; }
.wrap { max-width: 1180px; margin: 0 auto; padding: 0 16px; }
.bar { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 20px 0; border-bottom: 1px solid var(--line); font-size: 14px; }
.brand { font-weight: 800; letter-spacing: -0.02em; font-size: 18px; text-decoration: none; }
.nav { display: flex; gap: 22px; align-items: center; }
.nav a { text-decoration: none; color: var(--muted); }
.nav a:hover, .nav a.on { color: var(--fg); }
.muted { color: var(--muted); }
.eyebrow { font: 500 12px/1 var(--mono); letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); }
code, .mono { font-family: var(--mono); font-size: 0.9em; }
.btn { display: inline-flex; align-items: center; gap: 10px; font: 600 15px/1 var(--sans); background: var(--fg); color: var(--bg); border: 1px solid var(--fg); padding: 14px 20px; cursor: pointer; text-decoration: none; }
.btn.ghost { background: transparent; color: var(--fg); border-color: var(--line); }
.btn:disabled { opacity: 0.4; cursor: not-allowed; }
.btn:focus-visible, input:focus-visible, textarea:focus-visible { outline: 2px solid var(--fg); outline-offset: 2px; }
.rule { border: 0; border-top: 1px solid var(--line); margin: 0; }
`;
