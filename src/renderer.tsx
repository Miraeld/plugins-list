import PluginsList from './PluginsList';
import GlobalEntry from './GlobalEntry';
import { setReact } from './react';

export default function (context) {
	const { React, hooks } = context;

	// Must happen before any of our components render — see src/react.ts.
	setReact(React);

	// Per-site: a "Plugins" tab alongside Overview / Database / Tools.
	// Path is relative to the site: /main/site-info/:siteID/plugins-list
	hooks.addFilter('siteInfoToolsItem', (menu) => [
		...menu,
		{
			menuItem: 'Plugins',
			path: '/plugins-list',
			render: (props) => React.createElement(PluginsList, { ...props }),
		},
	]);

	// Global: an "All plugins" button above the site list, opening the matrix.
	hooks.addContent('SitesSidebar_SiteList:Before', () => React.createElement(GlobalEntry, { key: 'plugins-list' }));
}
