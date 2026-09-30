/** Read total row count from a paged API envelope (camelCase or PascalCase). */
export function pagedTotalCount(page) {
  if (page == null) return 0
  if (typeof page.totalCount === 'number') return page.totalCount
  if (typeof page.TotalCount === 'number') return page.TotalCount
  return 0
}
