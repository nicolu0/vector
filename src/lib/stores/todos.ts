import { writable } from 'svelte/store';

export type Todo = {
    id: string;
    task_id: string;
    title: string;
    done: boolean;
    ordinal?: number | null;
} & Record<string, unknown>;

export type TodosMap = Record<string, Todo[]>;

export const todosByTaskStore = writable<TodosMap>({});

export function setTodoDoneInStore(taskId: string, todoId: string, done: boolean) {
    todosByTaskStore.update((m) => {
        const list = m[taskId] ?? [];
        const idx = list.findIndex((t) => t.id === todoId);
        if (idx === -1) return m;
        const next = [...list];
        next[idx].done = done;
        return { ...m, [taskId]: next };
    });
}