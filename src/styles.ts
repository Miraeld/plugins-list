/**
 * Injected once as a <style> tag. tsc does not bundle assets, so shipping the
 * CSS as a string keeps the build to a plain `tsc` with no webpack in the way.
 */
const CSS = `
.pl-wrap { padding: 20px 24px 40px; font-size: 13px; }
.pl-head { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
.pl-title { font-size: 18px; font-weight: 600; margin: 0; flex: 0 0 auto; }
.pl-spacer { flex: 1 1 auto; }
.pl-tabs { display: inline-flex; border: 1px solid #d6dbe0; border-radius: 6px; overflow: hidden; }
.pl-tab { padding: 6px 14px; background: #fff; border: 0; cursor: pointer; font-size: 13px; color: #4a5560; }
.pl-tab + .pl-tab { border-left: 1px solid #d6dbe0; }
.pl-tab.is-on { background: #3fa9f5; color: #fff; }
.pl-input { padding: 6px 10px; border: 1px solid #d6dbe0; border-radius: 6px; font-size: 13px; min-width: 200px; }
.pl-btn { padding: 6px 12px; border: 1px solid #d6dbe0; border-radius: 6px; background: #fff; cursor: pointer; font-size: 13px; }
.pl-btn:hover { background: #f4f7f9; }
.pl-btn:disabled { opacity: .5; cursor: default; }
.pl-note { color: #6b7683; margin: 0 0 12px; }
.pl-err { color: #b3392f; background: #fdf0ef; border: 1px solid #f3c8c4; border-radius: 6px; padding: 8px 10px; margin-bottom: 12px; }
.pl-scroll { overflow: auto; max-height: calc(100vh - 260px); border: 1px solid #e3e7ea; border-radius: 8px; }
table.pl { border-collapse: separate; border-spacing: 0; width: 100%; }
table.pl th, table.pl td { padding: 7px 10px; text-align: left; white-space: nowrap; border-bottom: 1px solid #eef1f3; }
table.pl thead th { position: sticky; top: 0; z-index: 2; background: #f7f9fa; font-weight: 600; color: #4a5560; cursor: pointer; }
table.pl tbody tr:hover td { background: #f9fbfc; }
table.pl td.pl-name, table.pl th.pl-name { position: sticky; left: 0; z-index: 1; background: #fff; max-width: 320px; overflow: hidden; text-overflow: ellipsis; }
table.pl thead th.pl-name { z-index: 3; background: #f7f9fa; }
table.pl tbody tr:hover td.pl-name { background: #f9fbfc; }
.pl-slug { color: #94a1ad; font-size: 11px; display: block; }
.pl-cell { text-align: center; font-variant-numeric: tabular-nums; }
.pl-dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 5px; vertical-align: 1px; }
.pl-dot.active { background: #29b24a; }
.pl-dot.inactive { background: #c6ced6; }
.pl-dot.network { background: #7b5cd6; }
.pl-dot.unknown { background: #e8b13c; }
.pl-absent { color: #ccd4db; }
.pl-stale { color: #b3392f; font-weight: 600; }
.pl-tag { display: inline-block; padding: 1px 6px; border-radius: 4px; background: #eef1f3; color: #6b7683; font-size: 11px; margin-left: 6px; }
.pl-legend { display: flex; gap: 16px; flex-wrap: wrap; color: #6b7683; margin-top: 12px; font-size: 12px; }
.pl-empty { padding: 40px; text-align: center; color: #6b7683; }

/* Sidebar entry point */
.pl-sidebar-btn { display: flex; align-items: center; gap: 8px; width: calc(100% - 20px); margin: 4px 10px 8px;
  padding: 7px 10px; border: 1px solid #d6dbe0; border-radius: 6px; background: #fff; cursor: pointer;
  font-size: 12px; color: #4a5560; text-align: left; }
.pl-sidebar-btn:hover { background: #f4f7f9; border-color: #b9c2ca; }
.pl-sidebar-icon { width: 12px; height: 12px; border-radius: 2px; flex: 0 0 auto;
  background: linear-gradient(#3fa9f5 0 45%, #29b24a 55% 100%); }

/* Full-screen overlay for the global view */
.pl-overlay { position: fixed; inset: 0; z-index: 9999; background: rgba(22, 28, 34, .45);
  display: flex; align-items: center; justify-content: center; padding: 32px; }
.pl-overlay-inner { background: #fff; border-radius: 10px; width: 100%; height: 100%;
  max-width: 1500px; overflow: auto; box-shadow: 0 18px 50px rgba(0,0,0,.3); }
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
