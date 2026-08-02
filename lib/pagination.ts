export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

export function parsePagination(searchParams: URLSearchParams): PaginationParams {
  const rawPage = searchParams.get('page');
  const rawLimit = searchParams.get('limit') || searchParams.get('per_page');

  const page = Math.max(1, parseInt(rawPage || '1', 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(rawLimit || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT));

  return { page, limit };
}

export function paginationMeta(total: number, params: PaginationParams): PaginationMeta {
  return {
    page: params.page,
    limit: params.limit,
    total,
    totalPages: Math.ceil(total / params.limit) || 1,
  };
}

export function offset(params: PaginationParams): number {
  return (params.page - 1) * params.limit;
}

export function wrapResponse<T>(data: T[], total: number, params: PaginationParams): PaginatedResponse<T> {
  return {
    data,
    pagination: paginationMeta(total, params),
  };
}
