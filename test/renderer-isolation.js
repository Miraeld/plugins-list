/**
 * Reproduces how Local's renderer process actually loads and calls the addon.
 *
 * Two failures this guards against, both of which shipped once:
 *  1. Requiring anything main-process-only from the renderer — Local rejects the
 *     whole addon at startup with "Cannot find module <appPath>/api/index-bundle/main".
 *  2. Reading the site id from render props. Local calls filters as
 *     callback(value, ...args) and invokes TertiaryNavItem's render() with NO
 *     arguments, so the id must be captured at filter time.
 */
const path = require('path');
const Module = require('module');

const ADDON = path.join(__dirname, '..');
const FORBIDDEN = ['@getflywheel/local/main', 'electron', 'fs-extra'];
const leaked = [];
const failures = [];

const orig = Module._load;

Module._load = function (req, parent, isMain) {
	if (FORBIDDEN.includes(req)) {
		leaked.push(`${req}  (required by ${path.basename((parent && parent.filename) || '?')})`);

		// Mimic the renderer, where these are unresolvable.
		throw new Error(`Cannot find module '${req}'`);
	}

	if (req === '@getflywheel/local/renderer') {
		return { ipcAsync: async () => ({}) };
	}

	return orig(req, parent, isMain);
};

function check(label, condition, detail) {
	console.log(`${condition ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  — ${detail}` : ''}`);

	if (!condition) { failures.push(label); }
}

const React = require(path.join(ADDON, 'node_modules/react'));
const filters = {};
const contents = {};
const context = {
	React,
	hooks: {
		addFilter: (name, fn) => { (filters[name] = filters[name] || []).push(fn); },
		addContent: (name, fn) => { (contents[name] = contents[name] || []).push(fn); },
	},
};

try {
	require(path.join(ADDON, 'lib/renderer.js')).default(context);
	check('renderer loads without main-process modules', true);
} catch (e) {
	check('renderer loads without main-process modules', false, e.message);
}

check('no main-only modules leaked into renderer', leaked.length === 0, leaked.join(' | '));

if (!leaked.length && filters['siteInfoToolsItem']) {
	// Exactly how Local calls it: value first, then { routeChildrenProps }.
	const SITE_ID = 'abc123';
	const menu = filters['siteInfoToolsItem'][0](
		[{ menuItem: 'Overview', path: '/' }],
		{ routeChildrenProps: { match: { params: { siteID: SITE_ID } } } },
	);
	const ours = menu[menu.length - 1];

	check('adds a Plugins item', !!ours && ours.menuItem === 'Plugins', ours && ours.path);
	check('keeps the existing menu items', menu.length === 2);

	// TertiaryNavItem calls render() with no arguments.
	const element = ours.render();

	check(
		'render() with no args still knows the site',
		!!element && element.props && element.props.siteId === SITE_ID,
		`siteId=${element && element.props && element.props.siteId}`,
	);

	// And it must survive a missing context rather than throwing at load.
	let survived = true;

	try { filters['siteInfoToolsItem'][0]([], undefined); } catch (e) { survived = false; }

	check('filter tolerates a missing routeChildrenProps', survived);

	const sidebar = contents['SitesSidebar_SiteList:Before'];

	check('registers the global sidebar entry', !!sidebar && !!sidebar[0]());
}

console.log(failures.length ? `\n${failures.length} check(s) failed` : '\nall checks passed');
process.exit(failures.length ? 1 : 0);
