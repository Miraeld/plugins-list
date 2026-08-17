/**
 * Local hands the addon its own React instance via the renderer context.
 * We must use *that* one: a second copy of React in our node_modules means two
 * separate hook dispatchers, and every `useState` inside Local's tree throws
 * "Invalid hook call". So no module ever imports 'react' directly — they all
 * pull the live instance from here.
 */
let instance: any = null;

export function setReact(react: any): void {
	instance = react;
}

export function getReact(): any {
	if (!instance) {
		// Fallback for standalone/unit use, where there is no Local context.
		// eslint-disable-next-line
		instance = require('react');
	}

	return instance;
}
