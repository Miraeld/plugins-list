import { PluginsPanel } from './PluginsList';
import { injectStyles } from './styles';
import { getReact } from './react';

/**
 * Global entry point, rendered above the site list in the left sidebar.
 *
 * Deliberately not a route: Local renders `routesRoot` / `routes[main]` inside a
 * react-router <Switch>, so anything we add there must be a <Route> or it
 * swallows every other match — and reaching such a route needs a `history` the
 * sidebar hook never passes us. A fixed-position overlay sidesteps the router
 * entirely and works on any Local version.
 */
export default function GlobalEntry() {
	const React = getReact();
	const { useEffect, useState } = React;
	const [open, setOpen] = useState(false);

	useEffect(() => { injectStyles(); }, []);

	// Escape closes, matching every other Local overlay.
	useEffect(() => {
		if (!open) { return undefined; }

		const onKey = (event: KeyboardEvent) => {
			if (event.key === 'Escape') { setOpen(false); }
		};

		window.addEventListener('keydown', onKey);

		return () => window.removeEventListener('keydown', onKey);
	}, [open]);

	return (
		<div>
			<button className="pl-sidebar-btn" onClick={() => setOpen(true)} title="Plugins across all sites">
				<span className="pl-sidebar-icon" />
				All plugins
			</button>

			{open && (
				<div className="pl-overlay" onClick={(event) => {
					if (event.target === event.currentTarget) { setOpen(false); }
				}}>
					<div className="pl-overlay-inner">
						<PluginsPanel defaultView="all" lockView onClose={() => setOpen(false)} />
					</div>
				</div>
			)}
		</div>
	);
}
