import { writable, derived } from 'svelte/store';

export type Task = {
    id: string;
    title: string;
    done: boolean;
    ordinal?: number | null;
    tutorial?: boolean;
} & Record<string, unknown>;

export type TasksMap = Record<string, Task[]>;
export type MilestoneStatus = 'complete' | 'in_progress' | 'not_started';

export const tasksByMilestoneStore = writable<TasksMap>({});

export const milestoneStatusStore = derived(tasksByMilestoneStore, (m) => {
    const out: Record<string, { status: MilestoneStatus, done: boolean }> = {};
    for (const [milestoneId, tasks] of Object.entries(m)) {
        const total = tasks.length;
        const doneCount = tasks.filter((t) => t.done).length;
        
        let status: MilestoneStatus = 'not_started';
        if (total > 0) {
            if (doneCount === 0) status = 'not_started';
            else if (doneCount === total) status = 'complete';
            else status = 'in_progress';
        }
        out[milestoneId] = { status, done: status === 'complete' };
    }
    return out;
});

export function setTaskDoneInStore(milestoneId: string, taskId: string, done: boolean) {
    tasksByMilestoneStore.update((m) => {
        const list = m[milestoneId] ?? [];
        const idx = list.findIndex((t) => t.id === taskId);
        if (idx === -1) return m;

        const newList = [...list];
        newList[idx] = { ...list[idx], done };
        return { ...m, [milestoneId]: newList };
    });
}

export function getMilestoneStatus(map: TasksMap, milestoneId: string): MilestoneStatus {
    const list = map[milestoneId] ?? [];
    if (list.length === 0) return 'not_started';
    const doneCount = list.filter((t) => t.done).length;
    if (doneCount === list.length) return 'complete';
    if (doneCount === 0) return 'not_started';
    return 'in_progress';
}