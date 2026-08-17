import PluginsList from './PluginsList';

export default function (context) {
	const { React, hooks } = context;

	// Path is relative to the site being viewed: /main/site-info/:siteID/plugins-list
	hooks.addFilter('siteInfoToolsItem', (menu) => [
		...menu,
		{
			menuItem: 'Plugins',
			path: '/plugins-list',
			render: (props) => React.createElement(PluginsList, { ...props }),
		},
	]);
}
