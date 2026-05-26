import type { SearchEngineId } from '../models';

export interface SearchEngine {
  id: SearchEngineId;
  command: string;
  label: string;
  buildUrl: (query: string) => string;
}

export const SEARCH_ENGINES: SearchEngine[] = [
  {
    id: 'google',
    command: 'g',
    label: 'Google',
    buildUrl: (query) => `https://www.google.com/search?q=${encodeURIComponent(query)}`,
  },
  {
    id: 'baidu',
    command: 'bd',
    label: '百度',
    buildUrl: (query) => `https://www.baidu.com/s?wd=${encodeURIComponent(query)}`,
  },
  {
    id: 'bing',
    command: 'b',
    label: 'Bing',
    buildUrl: (query) => `https://www.bing.com/search?q=${encodeURIComponent(query)}`,
  },
  {
    id: 'github',
    command: 'gh',
    label: 'GitHub',
    buildUrl: (query) => `https://github.com/search?q=${encodeURIComponent(query)}`,
  },
  {
    id: 'chatgpt',
    command: 'ai',
    label: 'ChatGPT',
    buildUrl: (query) => `https://chatgpt.com/?q=${encodeURIComponent(query)}`,
  },
  {
    id: 'youtube',
    command: 'yt',
    label: 'YouTube',
    buildUrl: (query) => `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
  },
];

const COMMAND_MAP = new Map<string, SearchEngine>(
  SEARCH_ENGINES.map((engine) => [engine.command, engine]),
);

export function getEngineById(id: SearchEngineId): SearchEngine {
  return SEARCH_ENGINES.find((engine) => engine.id === id) ?? SEARCH_ENGINES[0];
}

export function parseSearchCommand(input: string): { engine?: SearchEngine; query: string } {
  const trimmed = input.trim();
  if (!trimmed) return { query: '' };

  const parts = trimmed.split(/\s+/);
  const maybeCommand = parts[0]?.toLowerCase();

  if (maybeCommand && COMMAND_MAP.has(maybeCommand)) {
    const engine = COMMAND_MAP.get(maybeCommand)!;
    return {
      engine,
      query: parts.slice(1).join(' ').trim(),
    };
  }

  return { query: trimmed };
}
