const JOINVECTOR_HOST = 'joinvector.ai';
const LOCALHOST_PORT = 'localhost:5173';

function buildUrl(path: string, origin: string): string {
	const normalizedPath = path.startsWith('/') ? path : `/${path}`;
	return new URL(normalizedPath, origin).toString();
}

export function resolveOAuthRedirect(path = '/'): string | undefined {
	if (typeof window === 'undefined') return undefined;

	const currentOrigin = window.location.origin;
	const currentHost = window.location.host;
	const isLocalhost = currentHost === LOCALHOST_PORT;
	const isJoinvectorHost =
		currentHost === JOINVECTOR_HOST || currentHost.endsWith(`.${JOINVECTOR_HOST}`);

	if (isLocalhost || isJoinvectorHost) {
		return buildUrl(path, currentOrigin);
	}

	try {
		if (document.referrer) {
			const referrerUrl = new URL(document.referrer);
			const referrerHost = referrerUrl.host;
			const referrerMatchesJoinvector =
				referrerHost === JOINVECTOR_HOST || referrerHost.endsWith(`.${JOINVECTOR_HOST}`);

			if (referrerMatchesJoinvector) {
				return buildUrl(path, `${referrerUrl.protocol}//${referrerUrl.host}`);
			}
		}
	} catch {
		// Ignore invalid referrer values and fall through to the default origin.
	}

	return buildUrl(path, currentOrigin);
}
