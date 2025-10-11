export type Difficulty = 'Easy' | 'Medium' | 'Hard' | 'Expert';

export type Job = {
  title: string;
  url: string;
};

export type Milestone = {
  name: string;
  objective: string;
  success_metrics: string[];
};

export type Metadata = {
  milestones: Milestone[];
};

export type Project = {
  title: string;
  difficulty: Difficulty;
  timeline: string;
  description: string;
  jobs: Job[];
  skills: string[];
  prerequisites: string[];
  metadata: Metadata;
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

  const prerequisites = project.prerequisites;
  if (!Array.isArray(prerequisites) || prerequisites.length < 2 || prerequisites.length > 6) {
    return false;
  }

  const metadata = project.metadata;
  if (!metadata || typeof metadata !== 'object') return false;
  const { milestones } = metadata as Record<string, unknown>;
  if (!Array.isArray(milestones) || milestones.length < 3 || milestones.length > 6) return false;

  const allJobsValid = jobs.every((job: unknown) => {
    if (!job || typeof job !== 'object') return false;
    const { title, url } = job as Record<string, unknown>;
    return typeof title === 'string' && typeof url === 'string';
  });

  const allSkillsValid = skills.every((skill: unknown) => typeof skill === 'string');

  const allMilestonesValid = milestones.every((milestone: unknown) => {
    if (!milestone || typeof milestone !== 'object') return false;
    const { name, objective, success_metrics } = milestone as Record<string, unknown>;
    if (
      typeof name !== 'string' ||
      typeof objective !== 'string' ||
      !Array.isArray(success_metrics) ||
      success_metrics.length < 2 ||
      success_metrics.length > 3
    ) {
      return false;
    }
    return success_metrics.every((metric) => typeof metric === 'string');
  });

  const allPrerequisitesValid = prerequisites.every((item: unknown) => typeof item === 'string');

  return allJobsValid && allSkillsValid && allPrerequisitesValid && allMilestonesValid;
}
