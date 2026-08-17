const path = require('path');
const Module = require('module');
const ADDON = path.join(__dirname, '..');

const FORBIDDEN = ['@getflywheel/local/main', 'electron', 'fs-extra'];
const touched = [];

const orig = Module._load;
Module._load = function (req, parent, isMain) {
  if (FORBIDDEN.includes(req)) {
    touched.push(`${req}  (required by ${path.basename(parent && parent.filename || '?')})`);
    // Mimic the renderer: these are unresolvable there.
    throw new Error(`Cannot find module '${req}'`);
  }
  if (req === '@getflywheel/local/renderer') return { ipcAsync: async () => ({}) };
  return orig(req, parent, isMain);
};

const React = require(path.join(ADDON, 'node_modules/react'));
const filters = {}, contents = {};
const context = { React, hooks: {
  addFilter: (n, f) => { (filters[n] = filters[n] || []).push(f); },
  addContent: (n, f) => { (contents[n] = contents[n] || []).push(f); },
}};

let ok = true;
try {
  require(path.join(ADDON, 'lib/renderer.js')).default(context);
  console.log('renderer loaded      : OK  (no main-process modules pulled in)');
} catch (e) {
  ok = false;
  console.log('renderer FAILED      :', e.message);
}
if (touched.length) { ok = false; console.log('LEAKED main-only deps:\n  - ' + touched.join('\n  - ')); }

if (ok) {
  console.log('siteInfoToolsItem    :', JSON.stringify(filters['siteInfoToolsItem'][0]([]).map(m => m.menuItem)));
  console.log('sidebar hook         :', Object.keys(contents));
}
process.exit(ok ? 0 : 1);
