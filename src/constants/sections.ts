export const FALLBACK_SECTIONS = Array.from({ length: 188 }, (_, i) => ({
  id: `fallback-${i + 1}`,
  name: `Sección ${i + 1}`,
  order: i,
  files: []
}));
