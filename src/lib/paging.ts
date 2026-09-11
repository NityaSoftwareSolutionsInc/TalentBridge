export const PAGE_SIZES = [10, 20, 25, 50, 100] as const;
export const PAGE_SIZE_STORAGE_KEY = "tb_page_size";
export const DEFAULT_PAGE_SIZE = 20;

export function parsePageSize(raw?: string | number | null): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  return (PAGE_SIZES as readonly number[]).includes(n) ? n : DEFAULT_PAGE_SIZE;
}

export function readStoredPageSize(): number {
  if (typeof window === "undefined") return DEFAULT_PAGE_SIZE;
  try {
    return parsePageSize(window.localStorage.getItem(PAGE_SIZE_STORAGE_KEY));
  } catch {
    return DEFAULT_PAGE_SIZE;
  }
}

export function storePageSize(size: number) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(parsePageSize(size)));
  } catch {
    /* ignore quota / private mode */
  }
}

export type PageSlice<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
  from: number;
  to: number;
};

export function paginate<T>(items: T[], page: number, pageSize: number): PageSlice<T> {
  const total = items.length;
  const size = parsePageSize(pageSize);
  const pages = Math.max(1, Math.ceil(total / size) || 1);
  const current = Math.min(Math.max(1, page || 1), pages);
  const start = (current - 1) * size;
  return {
    items: items.slice(start, start + size),
    total,
    page: current,
    pageSize: size,
    pages,
    from: total ? start + 1 : 0,
    to: Math.min(start + size, total),
  };
}
