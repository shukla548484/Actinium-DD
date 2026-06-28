export const notDeleted = { deletedAt: null };

export function parsePageLimit(query: { page?: number; limit?: number }) {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 20));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}
