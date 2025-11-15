export type AppModeContext = {
	isDemo: boolean;
};

export const APP_MODE_CONTEXT_KEY = Symbol('app-mode-context');

export const DEFAULT_APP_MODE: AppModeContext = { isDemo: false };
