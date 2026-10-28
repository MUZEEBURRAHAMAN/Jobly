import type { Profile, Settings, StudioData } from './types';

export const EMPTY_PROFILE: Profile = {
  basics: { name: '', headline: '', email: '', phone: '', location: '', summary: '', links: [] },
  experience: [],
  projects: [],
  education: [],
  skills: [],
  languages: [],
  order: ['summary', 'experience', 'projects', 'skills', 'education', 'languages'],
};

export const DEFAULT_SETTINGS: Settings = {
  ai: { provider: 'none', apiKey: '', model: 'claude-opus-5-5', baseUrl: '' },
  resumeStyle: { theme: 'modern', accent: '#b83a0a', paper: 'a4' },
  theme: 'system',
  onboarded: false,
};

export function emptyData(): StudioData {
  return { version: 1, profile: structuredClone(EMPTY_PROFILE), applications: [], settings: structuredClone(DEFAULT_SETTINGS) };
}

export const ANTHROPIC_MODELS = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', hint: 'Best writing' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', hint: 'Fast and capable' },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5', hint: 'Fastest, lowest cost' },
];

export const OPENAI_PRESETS = [
  { label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: '' },
  { label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', model: '' },
  { label: 'Ollama (this computer)', baseUrl: 'http://localhost:11434/v1', model: 'llama3.1' },
  { label: 'LM Studio (this computer)', baseUrl: 'http://localhost:1234/v1', model: '' },
];
