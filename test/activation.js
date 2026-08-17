/**
 * Exercises the activation path with Local 10's real service shapes.
 * The regression: status lives on siteProcessManager.getSiteStatus(site), not
 * site.status, so gating on site.status skipped WP-CLI and left every plugin
 * "unknown" even on a running site.
 */
const path = require('path');
const Module = require('module');

const ADDON = path.join(__dirname, '..');
const failures = [];
const state = { status: 'running', plugins: null, themes: null, userData: {}, wpCli: true };

const orig = Module._load;
Module._load = function (req, parent, isMain) {
  if (req === '@getflywheel/local/main') {
    const buildCradle = () => ({
      siteProcessManager: { getSiteStatus: () => state.status },
      wpCli: state.wpCli ? {
        getPlugins: async () => state.plugins,
        getThemes: async () => state.themes,
      } : undefined,
    });
    return {
      addIpcAsyncListener: (n, fn) => { handlers[n] = fn; },
      SiteData: { getSites: () => sites, getSite: (id) => sites[id] },
      UserData: { get: (k) => state.userData[k], set: (k, v) => { state.userData[k] = v; } },
      getServiceContainer: () => ({ cradle: buildCradle() }),
    };
  }
  if (req === 'electron') return { app: { getPath: () => '/tmp' }, shell: { showItemInFolder() {} } };
  return orig(req, parent, isMain);
};

const SITE_PATH = path.join(process.env.HOME, 'Local Sites/imagify');
const sites = { s1: { id: 's1', name: 'imagify', path: SITE_PATH, phpVersion: '8.4.10' } };
const handlers = {};
require(path.join(ADDON, 'lib/main.js')).default();

function check(label, cond, detail) {
  console.log(`${cond ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  — ${detail}` : ''}`);
  if (!cond) failures.push(label);
}

(async () => {
  // 1. Running site, WP-CLI answers → real states, no "unknown" left.
  state.status = 'running';
  state.plugins = [
    { file: 'imagify-plugin/imagify.php', name: 'imagify-plugin', status: 'active', version: '2.3.2' },
    { file: 'woocommerce/woocommerce.php', name: 'woocommerce', status: 'inactive', version: '9.4.2' },
    { file: 'akismet/akismet.php', name: 'akismet', status: 'active-network', version: '5.7' },
  ];
  state.themes = [{ name: 'twentytwentyfive', status: 'active', version: '1.5' }];

  let scan = await handlers['plugins-list:scan-site']('s1', false);
  const by = (slug) => scan.extensions.find((e) => e.slug === slug);

  check('source is wp-cli on a running site', scan.activeSource === 'wp-cli', scan.activeSource);
  check('no reason reported on success', !scan.activeReason, scan.activeReason);
  check('active plugin detected', by('imagify-plugin') && by('imagify-plugin').active === 'active',
    by('imagify-plugin') && by('imagify-plugin').active);
  check('inactive plugin detected', by('woocommerce') && by('woocommerce').active === 'inactive',
    by('woocommerce') && by('woocommerce').active);
  check('network-active mapped', by('akismet') && by('akismet').active === 'network-active',
    by('akismet') && by('akismet').active);
  check('active theme detected', by('twentytwentyfive') && by('twentytwentyfive').active === 'active',
    by('twentytwentyfive') && by('twentytwentyfive').active);
  const stubbed = ['imagify-plugin', 'woocommerce', 'akismet', 'twentytwentyfive'];
  const unknownStubbed = stubbed.filter((s) => !by(s) || by(s).active === 'unknown');
  check('every row wp-cli reported is resolved', unknownStubbed.length === 0, unknownStubbed.join(','));

  // 2. Stopped site → falls back to the cache written above, and says why.
  state.status = 'halted';
  scan = await handlers['plugins-list:scan-site']('s1', false);
  check('falls back to cache when stopped', scan.activeSource === 'cache', scan.activeSource);
  check('cache still resolves states', scan.extensions.find((e) => e.slug === 'imagify-plugin').active === 'active');
  check('explains why it is not live', /halted/.test(scan.activeReason || ''), scan.activeReason);

  // 3. WP-CLI throwing must not lose the scan, and must report the cause.
  state.status = 'running';
  state.plugins = null;
  state.userData = {};
  scan = await handlers['plugins-list:scan-site']('s1', false);
  check('survives wp-cli returning nothing', Array.isArray(scan.extensions) && scan.extensions.length > 0,
    `${scan.extensions.length} items`);
  check('reports the wp-cli failure', !!scan.activeReason, scan.activeReason);

  // 3b. WP-CLI naming a different entry file must still resolve, via the folder.
  state.status = 'running';
  state.userData = {};
  state.plugins = [{ file: 'imagify-plugin/some-other-entry.php', name: 'imagify-plugin', status: 'active', version: '2.3.2' }];
  state.themes = [];
  scan = await handlers['plugins-list:scan-site']('s1', false);
  check('resolves by folder when the entry file differs',
    scan.extensions.find((e) => e.slug === 'imagify-plugin').active === 'active',
    scan.extensions.find((e) => e.slug === 'imagify-plugin').active);

  // 4. Missing wpCli service entirely (older/newer Local).
  state.wpCli = false;
  scan = await handlers['plugins-list:scan-site']('s1', false);
  check('degrades when wpCli is absent',
    scan.activeSource !== 'wp-cli' && /WP-CLI service is unavailable/.test(scan.activeReason || ''),
    `${scan.activeSource}: ${scan.activeReason}`);

  console.log(failures.length ? `\n${failures.length} check(s) failed` : '\nall checks passed');
  process.exit(failures.length ? 1 : 0);
})();
