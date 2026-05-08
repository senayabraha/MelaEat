export const normalizeSupabaseUrl = (url) => {
  if (!url) return '';

  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
};
