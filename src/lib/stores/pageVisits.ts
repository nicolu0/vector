const visitedRoutes: Set<string> | null = typeof window === 'undefined' ? null : new Set();

export function hasVisitedRoute(routeKey: string): boolean {
	if (!visitedRoutes) return false;
	return visitedRoutes.has(routeKey);
}

export function markRouteVisited(routeKey: string): void {
	if (!visitedRoutes) return;
	visitedRoutes.add(routeKey);
}

export function resetVisitedRoutes(): void {
	if (!visitedRoutes) return;
	visitedRoutes.clear();
}
