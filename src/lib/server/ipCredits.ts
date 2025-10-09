import type { SupabaseClient } from '@supabase/supabase-js';

type DatabaseClient = SupabaseClient<any, any, any>;

type IpCreditRow = {
	ip: string;
	credits: number | null;
};

const TABLE_NAME = 'ip_credits';

export type IpCreditStatus =
	| {
			available: true;
			remaining: number;
			ip: string;
	  }
	| {
			available: false;
			remaining: number;
			ip: string;
	  };

async function upsertIpCredit(
	client: DatabaseClient,
	ip: string,
	credits: number
): Promise<IpCreditRow | null> {
	const { data, error } = await client
		.from(TABLE_NAME)
		.upsert({ ip, credits }, { onConflict: 'ip' })
		.select('ip, credits')
		.single();

	if (error) {
		console.error('Failed to upsert IP credit', { ip, error });
		return null;
	}

	return data;
}

export async function getIpCreditStatus(
	client: DatabaseClient,
	ip: string,
	{ initialCredits = 1 }: { initialCredits?: number } = {}
): Promise<IpCreditStatus | null> {
	const { data, error } = await client
		.from(TABLE_NAME)
		.select('ip, credits')
		.eq('ip', ip)
		.maybeSingle<IpCreditRow>();

	if (error) {
		console.error('Failed to fetch IP credit', { ip, error });
		return null;
	}

	if (!data) {
		const inserted = await upsertIpCredit(client, ip, initialCredits);
		if (!inserted) {
			return null;
		}
		const remaining = typeof inserted.credits === 'number' ? inserted.credits : 0;
		return {
			available: remaining > 0,
			remaining,
			ip
		};
	}

	const remaining = typeof data.credits === 'number' ? data.credits : 0;
	return {
		available: remaining > 0,
		remaining,
		ip
	};
}

export async function consumeIpCredit(
	client: DatabaseClient,
	ip: string,
	currentRemaining: number
): Promise<{ remaining: number } | null> {
	if (currentRemaining <= 0) {
		return { remaining: 0 };
	}

	const next = Math.max(0, currentRemaining - 1);

	const { data, error } = await client
		.from(TABLE_NAME)
		.update({ credits: next })
		.eq('ip', ip)
		.select('credits')
		.single<IpCreditRow>();

	if (error) {
		console.error('Failed to consume IP credit', { ip, error });
		return null;
	}

	const remaining = typeof data?.credits === 'number' ? data.credits : next;
	return { remaining };
}
