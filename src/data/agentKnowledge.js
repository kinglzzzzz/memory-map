import seedEntries from '../../knowledge/seed.json';

export const knowledgeBase = seedEntries.map((entry) => ({
  ...entry,
  id: entry.slug,
  answer: entry.content,
}));

export const knowledgeCategories = [...new Set(knowledgeBase.map((entry) => entry.category))];
