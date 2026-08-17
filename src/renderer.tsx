import PluginsList from './PluginsList';
import GlobalEntry from './GlobalEntry';
import { setReact } from './react';

export default function (context) {
	const { React, hooks } = context;

	// Must happen before any of our components render — see src/react.ts.
	setReact(React);

	/*
	 * Per-site: an item in the Tools tab's nav.
	 *
	 * Two things about this hook are easy to get wrong:
	 *  - Local calls filters as `callback(value, ...args)`, so the site only
	 *    reaches us through the second argument. There is no `props.match`.
	 *  - `TertiaryNavItem` invokes `render()` with NO arguments — every one of
	 *    Local's own items is a closure over `site`/`params`. So the site id has
	 *    to be captured here, at filter time, not read from render props.
	 */
	hooks.addFilter('siteInfoToolsItem', (menu, context2) => {
		const routeChildrenProps = context2 && context2.routeChildrenProps;
		const siteId = routeChildrenProps
			&& routeChildrenProps.match
			&& routeChildrenProps.match.params
			&& routeChildrenProps.match.params.siteID;

		return [
			...menu,
			{
				menuItem: 'Plugins',
				path: '/plugins-list',
				render: () => React.createElement(PluginsList, { siteId }),
			},
		];
	});

	// Global: an "All plugins" button above the site list, opening the matrix.
	hooks.addContent('SitesSidebar_SiteList:Before', () => React.createElement(GlobalEntry, { key: 'plugins-list' }));
}
