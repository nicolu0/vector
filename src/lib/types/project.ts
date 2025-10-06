export type Difficulty = 'Easy' | 'Medium' | 'Hard' | 'Expert';

export type Job = {
  title: string;
  url: string;
};

export type Project = {
  title: string;
  difficulty: Difficulty;
  timeline: string;
  description: string;
  jobs: Job[];
  skills: string[];
};

export function isProject(value: unknown): value is Project {
  if (!value || typeof value !== 'object') return false;
  const project = value as Record<string, unknown>;
  if (
    typeof project.title !== 'string' ||
    typeof project.description !== 'string' ||
    typeof project.timeline !== 'string' ||
    typeof project.difficulty !== 'string'
  ) {
    return false;
  }

  const jobs = project.jobs;
  if (!Array.isArray(jobs)) return false;

  const skills = project.skills;
  if (!Array.isArray(skills)) return false;

  const allJobsValid = jobs.every((job: unknown) => {
    if (!job || typeof job !== 'object') return false;
    const { title, url } = job as Record<string, unknown>;
    return typeof title === 'string' && typeof url === 'string';
  });

  const allSkillsValid = skills.every((skill: unknown) => typeof skill === 'string');

  return allJobsValid && allSkillsValid;
}
