import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	// TODO: hydrate these from persistent storage once wiring is ready.
	return {
		endGoal: '',
		currentSkillLevel: ''
	};
};
