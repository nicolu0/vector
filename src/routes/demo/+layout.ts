import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async () => {
	const project = {
		id: 'demo-project',
		title: 'Ship a polished personal site',
		description:
			'Explore how Vector keeps every milestone and task organized without wiring it up to your own Supabase account.',
		skills: ['Svelte', 'TypeScript', 'UI Design'],
		difficulty: 'Intermediate',
		domain: 'Web apps'
	};

	const milestone = {
		id: 'demo-milestone-1',
		title: 'Example Milestone',
		description: 'Sketch the first milestone to show how Vector groups the work.',
		project_id: 'demo-project',
		done: false,
		ordinal: 1
	};
	const task = {
		id: 'demo-task-1',
		title: 'Example Task',
		description: 'Milestones are broken down into tasks. You can generate 1 task a day. Most tasks can be finished within 30 minutes, but the difficulty will adjust according to your skill.',
		milestone_id: 'demo-milestone-1',
		project_id: 'demo-project',
		done: false,
		ordinal: 1
	};
	const todos = [{
		id: 'demo-todo-1',
		title: 'Click the circle on the left to check off a todo',
		task_id: 'demo-task-1',
		milestone_id: 'demo-milestone-1',
		project_id: 'demo-project',
		done: false,
		ordinal: 1
	}, {
		id: 'demo-todo-2',
		title: 'Check off all the todos to complete a task',
		task_id: 'demo-task-1',
		milestone_id: 'demo-milestone-1',
		project_id: 'demo-project',
		done: false,
		ordinal: 1
	}];

	return {
		user: { id: 'demo-user', email: 'demo@vector.dev' },
		tutorial: false,
		goal: 'Share a professional landing page with milestones that stay on track.',
		project,
		milestones: [milestone],
		tasks: [task],
		todos: todos,
		tasksByMilestone: { [milestone.id]: [task] },
		todosByTask: { [task.id]: todos },
		currentMilestoneId: milestone.id,
		currentTaskId: task.id,
		chat: { conversationId: null, messages: [] }
	};
};
