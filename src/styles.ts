/**
 * Injected once as a <style> tag. tsc does not bundle assets, so shipping the
 * CSS as a string keeps the build to a plain `tsc` with no webpack in the way.
 *
 * Theming: Local puts `Theme__Dark` or `Theme__Light` on <html> — it resolves
 * its own "auto" setting to one of those, so the class is always present and is
 * the authoritative signal. Colours are therefore variables redefined under
 * `.Theme__Dark`, with a `prefers-color-scheme` fallback that only applies when
 * neither class is there (a future Local, or the page opened standalone).
 *
 * Values are Local's own palette so the panel does not look like a stranger:
 * $gray-dark #262727, $gray-dark-alt #303031, $gray-dark50 #434344,
 * $gray75 #9f9c9c, $gray15 #e7e7e7, $gray5 #f7f6f6, $green #51bb7b.
 */
const CSS = `
:root {
	--pl-bg: #fff;
	--pl-surface: #fff;
	--pl-header: #f7f6f6;
	--pl-hover: #fafafa;
	--pl-border: #e7e7e7;
	--pl-border-strong: #c7c4c4;
	--pl-text: #131313;
	--pl-muted: #5d5e5e;
	--pl-faint: #9f9c9c;
	--pl-accent: #51bb7b;
	--pl-accent-text: #fff;
	--pl-danger: #8c2738;
	--pl-danger-bg: #ffe2df;
	--pl-danger-border: #fad1cd;
	--pl-chip: #e7e7e7;
	--pl-stale: #8c2738;
	--pl-absent: #c7c4c4;
	--pl-inactive-dot: #c7c4c4;
	--pl-shadow: rgba(0, 0, 0, .3);
	--pl-scrim: rgba(19, 19, 19, .45);
	--pl-dot-network: #7b5cd6;
}

/* Local's explicit dark theme. Same specificity as :root, so it must come after. */
.Theme__Dark {
	--pl-bg: #262727;
	--pl-surface: #303031;
	--pl-header: #262727;
	--pl-hover: #434344;
	--pl-border: #434344;
	--pl-border-strong: #5d5e5e;
	--pl-text: #fff;
	--pl-muted: #c7c4c4;
	--pl-faint: #9f9c9c;
	--pl-accent: #51bb7b;
	--pl-accent-text: #131313;
	--pl-danger: #f18085;
	--pl-danger-bg: #3a2124;
	--pl-danger-border: #8c2738;
	--pl-chip: #434344;
	--pl-stale: #f18085;
	--pl-absent: #5d5e5e;
	--pl-inactive-dot: #757676;
	--pl-shadow: rgba(0, 0, 0, .6);
	--pl-scrim: rgba(0, 0, 0, .6);
	--pl-dot-network: #a78bfa;
}

/* Fallback only when Local has not labelled the theme at all. */
@media (prefers-color-scheme: dark) {
	html:not(.Theme__Dark):not(.Theme__Light) {
		--pl-bg: #262727;
		--pl-surface: #303031;
		--pl-header: #262727;
		--pl-hover: #434344;
		--pl-border: #434344;
		--pl-border-strong: #5d5e5e;
		--pl-text: #fff;
		--pl-muted: #c7c4c4;
		--pl-faint: #9f9c9c;
		--pl-accent-text: #131313;
		--pl-danger: #f18085;
		--pl-danger-bg: #3a2124;
		--pl-danger-border: #8c2738;
		--pl-chip: #434344;
		--pl-stale: #f18085;
		--pl-absent: #5d5e5e;
		--pl-inactive-dot: #757676;
		--pl-shadow: rgba(0, 0, 0, .6);
		--pl-scrim: rgba(0, 0, 0, .6);
		--pl-dot-network: #a78bfa;
	}
}

.pl-wrap { padding: 20px 24px 40px; font-size: 13px; color: var(--pl-text); }
.pl-head { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
.pl-title { font-size: 18px; font-weight: 600; margin: 0; flex: 0 0 auto; color: var(--pl-text); }
.pl-spacer { flex: 1 1 auto; }
.pl-head label { color: var(--pl-muted); display: inline-flex; align-items: center; gap: 4px; }

.pl-tabs { display: inline-flex; border: 1px solid var(--pl-border); border-radius: 6px; overflow: hidden; }
.pl-tab { padding: 6px 14px; background: var(--pl-surface); border: 0; cursor: pointer; font-size: 13px; color: var(--pl-muted); }
.pl-tab + .pl-tab { border-left: 1px solid var(--pl-border); }
.pl-tab:hover:not(.is-on):not(:disabled) { background: var(--pl-hover); }
.pl-tab.is-on { background: var(--pl-accent); color: var(--pl-accent-text); font-weight: 600; }
.pl-tab:disabled { opacity: .45; cursor: default; }

.pl-input { padding: 6px 10px; border: 1px solid var(--pl-border); border-radius: 6px; font-size: 13px;
  min-width: 200px; background: var(--pl-surface); color: var(--pl-text); }
.pl-input::placeholder { color: var(--pl-faint); }
select.pl-input { min-width: 0; }

.pl-btn { padding: 6px 12px; border: 1px solid var(--pl-border); border-radius: 6px;
  background: var(--pl-surface); color: var(--pl-text); cursor: pointer; font-size: 13px; }
.pl-btn:hover:not(:disabled) { background: var(--pl-hover); border-color: var(--pl-border-strong); }
.pl-btn:disabled { opacity: .5; cursor: default; }

.pl-note { color: var(--pl-muted); margin: 0 0 12px; }
.pl-err { color: var(--pl-danger); background: var(--pl-danger-bg); border: 1px solid var(--pl-danger-border);
  border-radius: 6px; padding: 8px 10px; margin-bottom: 12px; }

.pl-scroll { overflow: auto; max-height: calc(100vh - 260px);
  border: 1px solid var(--pl-border); border-radius: 8px; background: var(--pl-surface); }

table.pl { border-collapse: separate; border-spacing: 0; width: 100%; color: var(--pl-text); }
table.pl th, table.pl td { padding: 7px 10px; text-align: left; white-space: nowrap;
  border-bottom: 1px solid var(--pl-border); }
table.pl thead th { position: sticky; top: 0; z-index: 2; background: var(--pl-header);
  font-weight: 600; color: var(--pl-muted); cursor: pointer; }
table.pl tbody tr:hover td { background: var(--pl-hover); }
table.pl td.pl-name, table.pl th.pl-name { position: sticky; left: 0; z-index: 1;
  background: var(--pl-surface); max-width: 320px; overflow: hidden; text-overflow: ellipsis; }
table.pl thead th.pl-name { z-index: 3; background: var(--pl-header); }
table.pl tbody tr:hover td.pl-name { background: var(--pl-hover); }

.pl-slug { color: var(--pl-faint); font-size: 11px; display: block; }
.pl-cell { text-align: center; font-variant-numeric: tabular-nums; }
.pl-dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 5px; vertical-align: 1px; }
.pl-dot.active { background: #51bb7b; }
.pl-dot.inactive { background: var(--pl-inactive-dot); }
.pl-dot.network { background: var(--pl-dot-network); }
.pl-dot.unknown { background: #e8b13c; }
.pl-absent { color: var(--pl-absent); }
.pl-stale { color: var(--pl-stale); font-weight: 600; }
.pl-tag { display: inline-block; padding: 1px 6px; border-radius: 4px; background: var(--pl-chip);
  color: var(--pl-muted); font-size: 11px; margin-left: 6px; }
.pl-legend { display: flex; gap: 16px; flex-wrap: wrap; color: var(--pl-muted); margin-top: 12px; font-size: 12px; }
.pl-empty { padding: 40px; text-align: center; color: var(--pl-muted); }

/* Sidebar entry point */
.pl-sidebar-btn { display: flex; align-items: center; gap: 8px; width: calc(100% - 20px); margin: 4px 10px 8px;
  padding: 7px 10px; border: 1px solid var(--pl-border); border-radius: 6px; background: var(--pl-surface);
  cursor: pointer; font-size: 12px; color: var(--pl-muted); text-align: left; }
.pl-sidebar-btn:hover { background: var(--pl-hover); border-color: var(--pl-border-strong); }
.pl-sidebar-icon { width: 12px; height: 12px; border-radius: 2px; flex: 0 0 auto;
  background: linear-gradient(#51bb7b 0 45%, #50c6db 55% 100%); }

/* Full-screen overlay for the global view */
.pl-overlay { position: fixed; inset: 0; z-index: 9999; background: var(--pl-scrim);
  display: flex; align-items: center; justify-content: center; padding: 32px; }
.pl-overlay-inner { background: var(--pl-bg); border-radius: 10px; width: 100%; height: 100%;
  max-width: 1500px; overflow: auto; box-shadow: 0 18px 50px var(--pl-shadow); }
.pl-overlay-inner .pl-scroll { max-height: none; }
`;

export function injectStyles(): void {
	const id = 'plugins-list-styles';

	if (typeof document === 'undefined' || document.getElementById(id)) { return; }

	const tag = document.createElement('style');

	tag.id = id;
	tag.textContent = CSS;
	document.head.appendChild(tag);
}
