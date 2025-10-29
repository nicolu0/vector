import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	// TODO: hydrate these from persistent storage once wiring is ready.
	return {
		endGoal: 'i want to be a jane street quant specializing as a c++ dev.',
		currentSkillLevel: 'i have no experience in finance or c++. i have some data analytics skills and experience in python'
	};
};
