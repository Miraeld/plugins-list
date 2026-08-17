import * as LocalRenderer from '@getflywheel/local/renderer';
import { IPC_EXPORT_CSV, IPC_SCAN_ALL, IPC_SCAN_SITE } from './lib/channels';
import { compareVersions } from './lib/version';
import { ActiveState, Extension, ExtensionKind, Matrix, SiteScan } from './lib/types';
import { injectStyles } from './styles';
import { getReact } from './react';

type View = 'site' | 'all';
type KindFilter = 'all' | ExtensionKind;

const KIND_LABEL: Record<ExtensionKind, string> = {
	plugin: 'Plugin',
	'mu-plugin': 'mu-plugin',
	theme: 'Theme',
};

function Dot({ state }: { state: ActiveState }) {
	const React = getReact();

	return <span className={`pl-dot ${state === 'network-active' ? 'network' : state}`} title={state} />;
}

function formatSize(bytes?: number): string {
	if (!bytes) { return '—'; }
	if (bytes < 1024 * 1024) { return `${Math.round(bytes / 1024)} KB`; }

	return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function csvCell(value: string | number): string {
	const text = String(value === undefined || value === null ? '' : value);

	return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

async function exportCsv(fileName: string, rows: Array<Array<string | number>>): Promise<void> {
	const contents = rows.map((row) => row.map(csvCell).join(',')).join('\n');

	await LocalRenderer.ipcAsync(IPC_EXPORT_CSV, fileName, contents);
}

/** Per-site table: everything on disk for one site. */
function SiteTable({ scan, query, kind }: { scan: SiteScan; query: string; kind: KindFilter }) {
	const React = getReact();
	const { useMemo, useState } = React;
	const [sortKey, setSortKey] = useState('name');
	const [asc, setAsc] = useState(true);

	const rows = useMemo(() => {
		const needle = query.trim().toLowerCase();
		const filtered = scan.extensions.filter((extension: Extension) => {
			if (kind !== 'all' && extension.kind !== kind) { return false; }
			if (!needle) { return true; }

			return `${extension.name} ${extension.slug} ${extension.author}`.toLowerCase().includes(needle);
		});
		const direction = asc ? 1 : -1;

		return filtered.sort((a: Extension, b: Extension) => {
			if (sortKey === 'version') { return compareVersions(a.version, b.version) * direction; }
			if (sortKey === 'size') { return ((a.size || 0) - (b.size || 0)) * direction; }
			if (sortKey === 'active') { return a.active.localeCompare(b.active) * direction; }

			return a.name.localeCompare(b.name) * direction;
		});
	}, [scan, query, kind, sortKey, asc]);

	const sortBy = (key: string) => () => {
		if (key === sortKey) { setAsc(!asc); } else { setSortKey(key); setAsc(true); }
	};

	if (!rows.length) { return <div className="pl-empty">Nothing matches that filter.</div>; }

	return (
		<div className="pl-scroll">
			<table className="pl">
				<thead>
					<tr>
						<th className="pl-name" onClick={sortBy('name')}>Name</th>
						<th onClick={sortBy('active')}>Status</th>
						<th onClick={sortBy('version')}>Version</th>
						<th>Requires WP</th>
						<th>Requires PHP</th>
						<th onClick={sortBy('size')}>Size</th>
						<th>Author</th>
					</tr>
				</thead>
				<tbody>
					{rows.map((extension: Extension) => (
						<tr key={`${extension.kind}:${extension.slug}`}>
							<td className="pl-name" title={extension.description}>
								{extension.name}
								{extension.kind !== 'plugin' && <span className="pl-tag">{KIND_LABEL[extension.kind]}</span>}
								<span className="pl-slug">{extension.pluginFile}</span>
							</td>
							<td><Dot state={extension.active} />{extension.active}</td>
							<td>{extension.version || '—'}</td>
							<td>{extension.requiresWp || '—'}</td>
							<td>{extension.requiresPhp || '—'}</td>
							<td>{formatSize(extension.size)}</td>
							<td>{extension.author || '—'}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

/** The cross-site matrix: one row per item, one column per site. */
function MatrixTable({ matrix, query, kind, staleOnly }: {
	matrix: Matrix; query: string; kind: KindFilter; staleOnly: boolean;
}) {
	const React = getReact();
	const { useMemo } = React;

	const rows = useMemo(() => {
		const needle = query.trim().toLowerCase();

		return matrix.rows.filter((row) => {
			if (kind !== 'all' && row.kind !== kind) { return false; }
			if (needle && !`${row.name} ${row.slug}`.toLowerCase().includes(needle)) { return false; }

			if (staleOnly) {
				return Object.values(row.sites)
					.some((cell) => cell.version && compareVersions(cell.version, row.newestVersion) < 0);
			}

			return true;
		});
	}, [matrix, query, kind, staleOnly]);

	if (!rows.length) { return <div className="pl-empty">Nothing matches that filter.</div>; }

	return (
		<div className="pl-scroll">
			<table className="pl">
				<thead>
					<tr>
						<th className="pl-name">Name</th>
						<th>Newest</th>
						<th>Sites</th>
						{matrix.sites.map((site) => (
							<th key={site.siteId} title={`WP ${site.wpVersion || '?'} · PHP ${site.phpVersion || '?'}`}>
								{site.siteName}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{rows.map((row) => (
						<tr key={`${row.kind}:${row.slug}`}>
							<td className="pl-name">
								{row.name}
								{row.kind !== 'plugin' && <span className="pl-tag">{KIND_LABEL[row.kind]}</span>}
								<span className="pl-slug">{row.slug}</span>
							</td>
							<td>{row.newestVersion || '—'}</td>
							<td className="pl-cell">{row.installCount}</td>
							{matrix.sites.map((site) => {
								const cell = row.sites[site.siteId];

								if (!cell) { return <td key={site.siteId} className="pl-cell pl-absent">—</td>; }

								const stale = cell.version && compareVersions(cell.version, row.newestVersion) < 0;

								return (
									<td key={site.siteId} className={`pl-cell${stale ? ' pl-stale' : ''}`}>
										<Dot state={cell.active} />{cell.version || '?'}
									</td>
								);
							})}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

/**
 * The whole panel. Used twice: inside a site's tab (siteId set, defaults to the
 * per-site view) and as the global page (no siteId, matrix only).
 */
export function PluginsPanel({ siteId, defaultView, lockView, onClose }: {
	siteId?: string;
	defaultView?: View;
	lockView?: boolean;
	onClose?: () => void;
}) {
	const React = getReact();
	const { useCallback, useEffect, useState } = React;

	const [view, setView] = useState(defaultView || (siteId ? 'site' : 'all')) as [View, (v: View) => void];
	const [query, setQuery] = useState('');
	const [kind, setKind] = useState('plugin') as [KindFilter, (k: KindFilter) => void];
	const [staleOnly, setStaleOnly] = useState(false);
	const [withSizes, setWithSizes] = useState(false);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');
	const [scan, setScan] = useState(null) as [SiteScan | null, (s: SiteScan) => void];
	const [matrix, setMatrix] = useState(null) as [Matrix | null, (m: Matrix) => void];

	useEffect(() => { injectStyles(); }, []);

	const load = useCallback(async () => {
		setLoading(true);
		setError('');

		try {
			if (view === 'site') {
				if (!siteId) { throw new Error('No site in context.'); }

				setScan(await LocalRenderer.ipcAsync(IPC_SCAN_SITE, siteId, withSizes) as SiteScan);
			} else {
				setMatrix(await LocalRenderer.ipcAsync(IPC_SCAN_ALL, false) as Matrix);
			}
		} catch (e) {
			setError((e as Error).message || String(e));
		} finally {
			setLoading(false);
		}
	}, [view, siteId, withSizes]);

	useEffect(() => { load(); }, [load]);

	const onExport = async () => {
		try {
			if (view === 'site' && scan) {
				await exportCsv(`${scan.siteName}-plugins.csv`, [
					['Name', 'Slug', 'Kind', 'Status', 'Version', 'Requires WP', 'Requires PHP', 'Author'],
					...scan.extensions.map((e) => [
						e.name, e.pluginFile, e.kind, e.active, e.version, e.requiresWp, e.requiresPhp, e.author,
					]),
				]);
			} else if (matrix) {
				await exportCsv('local-plugins-matrix.csv', [
					['Name', 'Slug', 'Kind', 'Newest', 'Sites', ...matrix.sites.map((s) => s.siteName)],
					...matrix.rows.map((row) => [
						row.name, row.slug, row.kind, row.newestVersion, row.installCount,
						...matrix.sites.map((s) => {
							const cell = row.sites[s.siteId];

							return cell ? `${cell.version} (${cell.active})` : '';
						}),
					]),
				]);
			}
		} catch (e) {
			setError(`Export failed: ${(e as Error).message}`);
		}
	};

	const freshness = scan && scan.activeSource === 'cache' && scan.activeCachedAt
		? `activation from cache (${new Date(scan.activeCachedAt).toLocaleString()})`
		: scan && scan.activeSource === 'none'
			? 'activation unknown — start the site for live data'
			: '';

	return (
		<div className="pl-wrap">
			<div className="pl-head">
				<h2 className="pl-title">{view === 'all' ? 'Plugins — all sites' : 'Plugins'}</h2>

				{!lockView && (
					<div className="pl-tabs">
						<button
							className={`pl-tab${view === 'site' ? ' is-on' : ''}`}
							disabled={!siteId}
							onClick={() => setView('site')}
						>
							This site
						</button>
						<button className={`pl-tab${view === 'all' ? ' is-on' : ''}`} onClick={() => setView('all')}>
							All sites
						</button>
					</div>
				)}

				<div className="pl-spacer" />

				<input
					className="pl-input"
					placeholder="Search name or slug…"
					value={query}
					onChange={(event) => setQuery(event.target.value)}
				/>
				<select className="pl-input" value={kind} onChange={(event) => setKind(event.target.value as KindFilter)}>
					<option value="plugin">Plugins</option>
					<option value="mu-plugin">mu-plugins</option>
					<option value="theme">Themes</option>
					<option value="all">Everything</option>
				</select>

				{view === 'all' && (
					<label>
						<input type="checkbox" checked={staleOnly} onChange={(event) => setStaleOnly(event.target.checked)} />
						{' '}Stale only
					</label>
				)}
				{view === 'site' && (
					<label>
						<input type="checkbox" checked={withSizes} onChange={(event) => setWithSizes(event.target.checked)} />
						{' '}Sizes
					</label>
				)}

				<button className="pl-btn" onClick={load} disabled={loading}>{loading ? 'Scanning…' : 'Rescan'}</button>
				<button className="pl-btn" onClick={onExport} disabled={loading}>Export CSV</button>
				{onClose && <button className="pl-btn" onClick={onClose}>Close</button>}
			</div>

			{error && <div className="pl-err">{error}</div>}

			{view === 'site' && scan && (
				<p className="pl-note">
					{scan.extensions.filter((e) => e.kind === 'plugin').length} plugins
					{' · '}{scan.extensions.filter((e) => e.kind === 'mu-plugin').length} mu-plugins
					{' · '}{scan.extensions.filter((e) => e.kind === 'theme').length} themes
					{' · '}WP {scan.wpVersion || '?'}{scan.multisite ? ' (multisite)' : ''}
					{' · '}PHP {scan.phpVersion || '?'}
					{freshness ? ` — ${freshness}` : ''}
				</p>
			)}

			{view === 'all' && matrix && (
				<p className="pl-note">
					{matrix.rows.length} unique items across {matrix.sites.length} sites.
					{' '}Red means older than the newest copy you have locally.
				</p>
			)}

			{loading && <div className="pl-empty">Reading from disk…</div>}
			{!loading && view === 'site' && scan && <SiteTable scan={scan} query={query} kind={kind} />}
			{!loading && view === 'all' && matrix && (
				<MatrixTable matrix={matrix} query={query} kind={kind} staleOnly={staleOnly} />
			)}

			<div className="pl-legend">
				<span><span className="pl-dot active" />active</span>
				<span><span className="pl-dot network" />network active</span>
				<span><span className="pl-dot inactive" />installed, inactive</span>
				<span><span className="pl-dot unknown" />unknown (site not started)</span>
				<span><span className="pl-absent">—</span> not installed</span>
			</div>
		</div>
	);
}

/** Entry point for the per-site tools tab. */
export default function PluginsList(props: { match?: { params?: { siteID?: string } } }) {
	const React = getReact();

	return <PluginsPanel siteId={props?.match?.params?.siteID} />;
}
