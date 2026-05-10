import { HttpParams } from '@angular/common/http';
import { PageRequest } from '@shared/models';

/**
 * Converts a PageRequest into Angular HttpParams, skipping undefined/null/empty
 * fields. An optional extras map appends additional query parameters (e.g. a
 * lineId filter specific to one endpoint).
 */
export function pageRequestToHttpParams(
  req: PageRequest,
  extras?: Record<string, string | number | boolean | undefined | null>,
): HttpParams {
  let params = new HttpParams();
  if (req.page !== undefined) { params = params.set('page', String(req.page)); }
  if (req.size !== undefined) { params = params.set('size', String(req.size)); }
  if (req.sortBy) { params = params.set('sortBy', req.sortBy); }
  if (req.sortDir) { params = params.set('sortDir', req.sortDir); }
  if (req.search && req.search.trim().length > 0) { params = params.set('search', req.search.trim()); }
  if (extras) {
    for (const [k, v] of Object.entries(extras)) {
      if (v !== undefined && v !== null && String(v).length > 0) {
        params = params.set(k, String(v));
      }
    }
  }
  return params;
}
