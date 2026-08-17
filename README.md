# Plugins List — a Local addon

See every plugin, mu-plugin and theme installed across all your Local sites — **without starting them**.

Local gives you no way to answer "what's installed on this site?" short of booting it and opening
`wp-admin/plugins.php`. This addon reads it straight off disk.

## What it does

**This site** — a full table of everything under `wp-content`: name, version, `Requires at least`,
`Requires PHP`, author, and optionally folder size. mu-plugins and themes included.

**All sites** — the cross-site matrix. One row per plugin, one column per site:

```
Plugin              Newest   Sites   site-a    site-b    client-x
woocommerce         9.4.2      3     ● 9.4.2   ● 9.4.2   ● 9.1.0
wp-rocket           3.17.0     2     ● 3.17.0     —      ● 3.17.0
some-old-plugin     1.2.0      1        —         —      ○ 1.2.0
```

`●` active · `○` installed but inactive · `—` not installed · red version = older than your newest copy.

Filter to plugins/themes/mu-plugins, search, show **stale only**, and export either view to CSV.

## How it reads the data

Two tiers, so a stopped site still tells you something:

| Data | Source | Needs the site running? |
| --- | --- | --- |
| Installed plugins/themes, versions, requirements | Plugin header comment, first 8KB of each file — same as WP's `get_file_data()` | No |
| WP version | `wp-includes/version.php` | No |
| Multisite | `wp-config.php` | No |
| Active / inactive, active theme | `wpCli.getPlugins()` / `getThemes()`, gated on `siteProcessManager.getSiteStatus(site) === 'running'` | Yes — otherwise falls back to a per-site cache, then to `unknown`, and always states the reason |

Nothing is written to your sites. The only persisted state is the activation cache in Local's user data.

## Develop

```bash
npm install
npm run build       # or: npm run watch
```

Then symlink it into Local's addons directory and enable it in Local → Add-ons:

```bash
ln -s "$PWD" ~/Library/Application\ Support/Local/addons/plugins-list
```

macOS paths above; on Windows it's `%APPDATA%\Local\addons`.

## Known gaps

- Activation state needs the site running at least once. Local can't reach MySQL for a stopped site.
- No wp.org lookup yet, so "newest" means *the newest copy across your own sites*, not the newest release.

MIT.
