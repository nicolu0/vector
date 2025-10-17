export type Difficulty = 'Easy' | 'Medium' | 'Hard' | 'Expert';

export type Job = {
  title: string;
  url: string;
};

export type Deliverable = {
  task: string;
  spec: string;
  implementation: string[];
  code: string;
};

export type LearningMaterial = {
  title: string;
  body: string;
};

export type Section = {
  name: string;
  overview: string;
  deliverables: Deliverable[];
  learning_materials: LearningMaterial[];
};

export type Metadata = Section[];

export type Project = {
  title: string;
  difficulty: Difficulty;
  timeline: string;
  description: string;
  jobs: Job[];
  skills: string[];
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

  const metadata = project.metadata;
  if (!Array.isArray(metadata) || metadata.length < 3 || metadata.length > 15) return false;

  const allJobsValid = jobs.every((job: unknown) => {
    if (!job || typeof job !== 'object') return false;
    const { title, url } = job as Record<string, unknown>;
    return typeof title === 'string' && typeof url === 'string';
  });

  const allSkillsValid = skills.every((skill: unknown) => typeof skill === 'string');

  const allSectionsValid = metadata.every((section: unknown) => {
    if (!section || typeof section !== 'object') return false;
    const { name, overview, deliverables, learning_materials } = section as Record<string, unknown>;

    if (typeof name !== 'string' || typeof overview !== 'string') return false;

    if (!Array.isArray(deliverables)) return false;
    if (!Array.isArray(learning_materials)) return false;

    // Validate deliverables
    const allDeliverablesValid = deliverables.every((deliverable: unknown) => {
      if (!deliverable || typeof deliverable !== 'object') return false;
      const { task, spec, implementation, code } = deliverable as Record<string, unknown>;
      return (
        typeof task === 'string' &&
        typeof spec === 'string' &&
        Array.isArray(implementation) &&
        implementation.every((item: unknown) => typeof item === 'string') &&
        typeof code === 'string'
      );
    });

    // Validate learning materials
    const allLearningMaterialsValid = learning_materials.every((material: unknown) => {
      if (!material || typeof material !== 'object') return false;
      const { title, body } = material as Record<string, unknown>;
      return typeof title === 'string' && typeof body === 'string';
    });

    return allDeliverablesValid && allLearningMaterialsValid;
  });

  return allJobsValid && allSkillsValid && allSectionsValid;
}
