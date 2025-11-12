import { writable } from 'svelte/store';

export type Task = {
    id: string;
    title: string;
    done: boolean;
    ordinal?: number | null;
    tutorial?: boolean;
} & Record<string, unknown>;

export type TasksMap = Record<string, Task[]>;

export const tasksByMilestoneStore = writable<TasksMap>({});

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