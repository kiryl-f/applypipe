import { Config } from '../config';

export interface AIService {
  generateCoverLetter(resume: string, jobDescription: string): Promise<string>;
}

export function createAIService(config: Config): AIService {
  return {
    generateCoverLetter: async (resume: string, jobDescription: string): Promise<string> => {
      const response = await fetch(config.openRouter.endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.openRouter.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/applypipe',
          'X-Title': 'ApplyPipe',
        },
        body: JSON.stringify({
          model: config.openRouter.model,
          messages: [
            {
              role: 'system',
              content: 'You are a professional career coach and copywriter. Write a concise, compelling, and natural-sounding cover letter matching the candidate\'s resume to the job description provided.',
            },
            {
              role: 'user',
              content: `Candidate Resume:\n${resume}\n\nJob Description:\n${jobDescription}\n\nWrite a short cover letter for this position.`,
            },
          ],
          temperature: 0.7,
        }),
      });

      const data = (await response.json()) as any;

      if (!data.choices || data.choices.length === 0) {
        throw new Error(`OpenRouter API Error: ${JSON.stringify(data)}`);
      }

      return data.choices[0].message.content;
    },
  };
}
