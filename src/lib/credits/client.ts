export type CreditSource = 'user' | 'ip';

export type CreditCheckResult = {
	available: boolean;
	remaining: number;
	source: CreditSource;
	ip: string | null;
};

export async function checkCreditAvailability(
	fetchImpl: typeof fetch = fetch
): Promise<CreditCheckResult> {
	try {
		const response = await fetchImpl('/api/ip-credit', {
			method: 'GET',
			headers: { accept: 'application/json' }
		});

		if (!response.ok) {
			throw new Error(`Credit check failed: ${response.status}`);
		}

		const data = (await response.json()) as Partial<CreditCheckResult>;
		return {
			available: Boolean(data.available),
			remaining: typeof data.remaining === 'number' ? data.remaining : 0,
			source: data.source === 'user' ? 'user' : 'ip',
			ip: typeof data.ip === 'string' ? data.ip : null
		};
	} catch (err) {
		console.error('Unable to check credit availability', err);
		return { available: false, remaining: 0, source: 'ip', ip: null };
	}
}

