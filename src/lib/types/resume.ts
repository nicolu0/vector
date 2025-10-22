export type ProjectRating = 'No change' | 'Small tweaks' | 'Needs Improvement';

export type ProjectItem = {
    title: string;
    stack: string | null;
    bullets: string[];
    rating: { label: ProjectRating };
    notes: string[];
};

export type ResumeProjects = {
    overall_strength: 'Strong' | 'Average' | 'Needs Work';
    projects: ProjectItem[];
}

export const resumeProjectsJsonSchema = {
    type: 'json_schema',
    name: 'resume_projects',
    strict: true,
    schema: {
        type: 'object',
        additionalProperties: false,
        required: ['overall_strength', 'projects'],
        properties: {
            overall_strength: { 
                type: 'string',
                enum: ['Strong', 'Average', 'Needs Work'] 
            },
            projects: { 
                type: 'array',
                minItems: 0,
                maxItems: 10,
                items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['title', 'stack', 'bullets', 'rating', 'notes'],
                    properties: {
                        title: { type: 'string', minLength: 1, maxLength: 200 },
                        stack: { type: ['string', 'null'] },
                        bullets: {
                            type: 'array',
                            minItems: 1,
                            maxItems: 20,
                            items: { type: 'string', minLength: 1 }
                        },
                        rating: {
                            type: 'object',
                            additionalProperties: false,
                            required: ['label'],
                            properties: {
                                label: { 
                                    type: 'string',
                                    enum: ['No change', 'Small tweaks', 'Needs Improvement']
                                }
                            }
                        },
                        notes: {
                            type: 'array',
                            minItems: 0,
                            maxItems: 20,
                            items: { type: 'string', minLength: 1 }
                        }
                    }
                } 
            }
        },
    }
} as const;