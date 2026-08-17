import * as path from 'path';
import * as fs from 'fs-extra';
import { app, shell } from 'electron';
import * as LocalMain from '@getflywheel/local/main';
import { scanSiteFiles } from './lib/scan';
import { compareVersions } from './lib/version';
import { ActiveState, Extension, Matrix, MatrixRow, SiteScan } from './lib/types';

import { IPC_EXPORT_CSV, IPC_SCAN_ALL, IPC_SCAN_SITE } from './lib/channels';

// V2: keys are now `kind:identifier` rather than bare plugin files, so old
// entries would silently never match.
const CACHE_KEY = 'pluginsListActivationCacheV2';

interface CacheEntry {
	at: number;
	/** `plugin:<file>` or `theme:<slug>` -> state */
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
	const raw = site?.paths?.webRoot || path.join(site?.path || '', 'app', 'public');

	// sites.json stores most paths with a literal "~" (10 of 12 here), which
	// path.join happily turns into a directory that does not exist. Local
	// exports formatHomePath for precisely this.
	try {
		return (LocalMain as any).formatHomePath(raw);
	} catch (e) {
		return raw.startsWith('~') ? path.join(process.env.HOME || '', raw.slice(1)) : raw;
	}
}

function phpVersionOf(site: any): string {
	return site?.phpVersion || site?.services?.php?.version || '';
}

/**
 * Local's own status, which is NOT on the site record — reading `site.status`
 * returns undefined and silently skips the WP-CLI call entirely.
 */
function statusOf(site: any): string {
	try {
		const { siteProcessManager } = LocalMain.getServiceContainer().cradle as any;

		return siteProcessManager.getSiteStatus(site) || '';
	} catch (e) {
		return site?.status || '';
	}
}

function toState(status: string): ActiveState {
	if (status === 'active') { return 'active'; }
	if (status === 'active-network') { return 'network-active'; }

	// must-use and dropin are on whether WordPress lists them or not.
	if (status === 'must-use' || status === 'dropin') { return 'active'; }

	return 'inactive';
}

/**
 * Ask WP-CLI what is active. Requires a running site, so a failure here is
 * routine — but it must be *reported*, not swallowed, or the UI shows an amber
 * "unknown" with no way to find out why.
 */
async function fetchActivation(
	site: any,
): Promise<{ states?: Record<string, ActiveState>; error?: string }> {
	const status = statusOf(site);

	if (status !== 'running') {
		return { error: `site is "${status || 'not running'}" — start it for live activation data` };
	}

	try {
		const { wpCli } = LocalMain.getServiceContainer().cradle as any;

		if (!wpCli || typeof wpCli.getPlugins !== 'function') {
			return { error: 'Local\'s WP-CLI service is unavailable in this version' };
		}

		const [plugins, themes] = await Promise.all([
			wpCli.getPlugins(site).catch((e: Error) => { throw new Error(`wp plugin list failed: ${e.message}`); }),
			wpCli.getThemes(site).catch(() => null),
		]);

		if (!plugins) { return { error: 'wp plugin list returned nothing' }; }

		const states: Record<string, ActiveState> = {};

		for (const row of plugins) {
			if (!row || !row.file) { continue; }

			// `file` is the plugins-dir-relative path, matching our pluginFile.
			states[`plugin:${row.file}`] = toState(row.status);

			// Also index by folder, so a row still resolves if we picked a
			// different entry PHP file than WordPress did.
			const folder = String(row.file).split('/')[0];

			states[`slug:${folder}`] = toState(row.status);
		}

		for (const row of themes || []) {
			if (row && row.name) { states[`theme:${row.name}`] = toState(row.status); }
		}

		return { states };
	} catch (e) {
		return { error: (e as Error).message };
	}
}

function applyActivation(extensions: Extension[], states: Record<string, ActiveState>): void {
	for (const extension of extensions) {
		// mu-plugins are always on; the scanner already marked them active.
		if (extension.kind === 'mu-plugin') { continue; }

		const state = extension.kind === 'theme'
			? states[`theme:${extension.slug}`]
			: states[`plugin:${extension.pluginFile}`] || states[`slug:${extension.slug}`];

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

	const live = await fetchActivation(site);

	if (live.states) {
		applyActivation(extensions, live.states);
		activeSource = 'wp-cli';
		writeCacheEntry(siteId, { at: Date.now(), states: live.states });
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
		activeReason: live.error,
		siteStatus: statusOf(site),
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
