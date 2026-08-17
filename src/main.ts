import * as path from 'path';
import * as fs from 'fs-extra';
import { app, shell } from 'electron';
import * as LocalMain from '@getflywheel/local/main';
import { scanSiteFiles, compareVersions } from './lib/scan';
import { ActiveState, Extension, Matrix, MatrixRow, SiteScan } from './lib/types';

export const IPC_SCAN_SITE = 'plugins-list:scan-site';
export const IPC_SCAN_ALL = 'plugins-list:scan-all';
export const IPC_EXPORT_CSV = 'plugins-list:export-csv';

const CACHE_KEY = 'pluginsListActivationCache';

interface CacheEntry {
	at: number;
	/** pluginFile -> state */
	states: Record<string, ActiveState>;
}

type Cache = Record<string, CacheEntry>;

function readCache(): Cache {
	try {
		return (LocalMain.UserData.get(CACHE_KEY) as Cache) || {};
	} catch (e) {
		return {};
	}
}

function writeCacheEntry(siteId: string, entry: CacheEntry): void {
	try {
		const cache = readCache();

		cache[siteId] = entry;
		LocalMain.UserData.set(CACHE_KEY, cache);
	} catch (e) {
		/* cache is a nicety, never fail a scan over it */
	}
}

function publicDirOf(site: any): string {
	// `site.paths.webRoot` is the modern field; older site records only carry `path`.
	return site?.paths?.webRoot || path.join(site?.path || '', 'app', 'public');
}

function phpVersionOf(site: any): string {
	return site?.phpVersion || site?.services?.php?.version || '';
}

/**
 * Ask WP-CLI which plugins are active. Only works while the site is running,
 * so every failure path is expected rather than exceptional.
 */
async function fetchActivation(site: any): Promise<Record<string, ActiveState> | null> {
	try {
		const { wpCli } = LocalMain.getServiceContainer().cradle as any;
		const raw = await wpCli.run(site, [
			'plugin', 'list', '--format=json', '--fields=file,status',
		]);
		const jsonStart = String(raw).indexOf('[');

		if (jsonStart === -1) { return null; }

		const rows = JSON.parse(String(raw).slice(jsonStart));
		const states: Record<string, ActiveState> = {};

		for (const row of rows) {
			if (!row || !row.file) { continue; }

			if (row.status === 'active') {
				states[row.file] = 'active';
			} else if (row.status === 'active-network') {
				states[row.file] = 'network-active';
			} else if (row.status === 'must-use' || row.status === 'dropin') {
				states[row.file] = 'active';
			} else {
				states[row.file] = 'inactive';
			}
		}

		return states;
	} catch (e) {
		return null;
	}
}

function applyActivation(extensions: Extension[], states: Record<string, ActiveState>): void {
	for (const extension of extensions) {
		if (extension.kind !== 'plugin') { continue; }

		const state = states[extension.pluginFile];

		if (state) { extension.active = state; }
	}
}

async function scanSite(site: any, withSizes: boolean): Promise<SiteScan> {
	const siteId = site.id;
	const publicDir = publicDirOf(site);
	const errors: string[] = [];

	const { extensions, wpVersion, multisite } = await scanSiteFiles(publicDir, withSizes);

	if (!extensions.length) {
		errors.push(`No plugins or themes found under ${publicDir}/wp-content`);
	}

	let activeSource: SiteScan['activeSource'] = 'none';
	let activeCachedAt: number | undefined;

	const live = site.status === 'running' ? await fetchActivation(site) : null;

	if (live) {
		applyActivation(extensions, live);
		activeSource = 'wp-cli';
		writeCacheEntry(siteId, { at: Date.now(), states: live });
	} else {
		const cached = readCache()[siteId];

		if (cached) {
			applyActivation(extensions, cached.states);
			activeSource = 'cache';
			activeCachedAt = cached.at;
		}
	}

	extensions.sort((a, b) => a.name.localeCompare(b.name));

	return {
		siteId,
		siteName: site.name,
		sitePath: publicDir,
		wpVersion,
		phpVersion: phpVersionOf(site),
		multisite,
		extensions,
		activeSource,
		activeCachedAt,
		errors,
	};
}

function allSites(): any[] {
	const sites = LocalMain.SiteData.getSites() || {};

	return Object.values(sites).sort((a: any, b: any) => String(a.name).localeCompare(String(b.name)));
}

/** Fold per-site scans into the cross-site matrix, keyed by slug + kind. */
function buildMatrix(scans: SiteScan[]): Matrix {
	const rows = new Map<string, MatrixRow>();

	for (const scan of scans) {
		for (const extension of scan.extensions) {
			const key = `${extension.kind}:${extension.slug}`;
			let row = rows.get(key);

			if (!row) {
				row = {
					slug: extension.slug,
					name: extension.name,
					kind: extension.kind,
					newestVersion: extension.version,
					sites: {},
					installCount: 0,
				};
				rows.set(key, row);
			}

			row.sites[scan.siteId] = { version: extension.version, active: extension.active };
			row.installCount += 1;

			if (compareVersions(extension.version, row.newestVersion) > 0) {
				row.newestVersion = extension.version;
			}
		}
	}

	return {
		sites: scans.map((scan) => ({
			siteId: scan.siteId,
			siteName: scan.siteName,
			wpVersion: scan.wpVersion,
			phpVersion: scan.phpVersion,
		})),
		rows: [...rows.values()].sort((a, b) => a.name.localeCompare(b.name)),
		errors: scans.flatMap((scan) => scan.errors.map((error) => `${scan.siteName}: ${error}`)),
	};
}

export default function (): void {
	LocalMain.addIpcAsyncListener(IPC_SCAN_SITE, async (siteId: string, withSizes = false) => {
		const site = LocalMain.SiteData.getSite(siteId);

		if (!site) { throw new Error(`Unknown site: ${siteId}`); }

		return scanSite(site, withSizes);
	});

	LocalMain.addIpcAsyncListener(IPC_SCAN_ALL, async (withSizes = false) => {
		const sites = allSites();
		const scans: SiteScan[] = [];

		// Sequential on purpose: a WP-CLI call per running site in parallel
		// hammers the machine, and the disk scan is already sub-second.
		for (const site of sites) {
			try {
				scans.push(await scanSite(site, withSizes));
			} catch (e) {
				scans.push({
					siteId: site.id,
					siteName: site.name,
					sitePath: publicDirOf(site),
					wpVersion: '',
					phpVersion: phpVersionOf(site),
					multisite: false,
					extensions: [],
					activeSource: 'none',
					errors: [`Scan failed: ${(e as Error).message}`],
				});
			}
		}

		return buildMatrix(scans);
	});

	// The renderer builds the CSV text; main only owns writing it somewhere real,
	// since anchor-based downloads are unreliable inside Electron.
	LocalMain.addIpcAsyncListener(IPC_EXPORT_CSV, async (fileName: string, contents: string) => {
		const safeName = String(fileName).replace(/[^a-zA-Z0-9._-]/g, '-');
		const target = path.join(app.getPath('downloads'), safeName);

		await fs.writeFile(target, contents, 'utf8');
		shell.showItemInFolder(target);

		return target;
	});
}
