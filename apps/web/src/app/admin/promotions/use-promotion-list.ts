'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CampaignRow } from '@/lib/promotions/types';
import { fetchCampaignPage } from './studio-api';
import { filtersToApiQuery, filtersToUrlQuery, type Filters } from './studio-logic';

export type ListState = 'loading' | 'ready' | 'error' | 'forbidden';

/** Campaign list: applied filters, cursor pagination and in-place row refresh. */
export function usePromotionList(initialFilters: Filters) {
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [rows, setRows] = useState<CampaignRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [state, setState] = useState<ListState>('loading');
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);
  // Incremented per first-page request; a response from an older generation is discarded.
  const generation = useRef(0);
  // Synchronous guard: two clicks can land before React re-renders, so state alone cannot stop a double fetch.
  const loadMoreInFlight = useRef(false);

  /**
   * Loads page one for the given filters. A reload with unchanged filters keeps the rows already on screen if
   * it fails; a filter change never does, because stale rows would then belong to a different result set.
   */
  const loadFirstPage = useCallback(async (active: Filters, keepRowsOnError = false) => {
    const mine = ++generation.current;
    setState('loading');
    setMoreFailed(false);
    // A cursor from the previous result set must never be used while this reload is in flight, or the new
    // first page could be shifted by a stale "load more".
    setNextCursor(null);
    const result = await fetchCampaignPage(filtersToApiQuery(active, null));
    if (mine !== generation.current) return;
    if (!result.ok) {
      if (!keepRowsOnError) setRows([]);
      setNextCursor(null);
      setState(result.code === 'forbidden' ? 'forbidden' : 'error');
      return;
    }
    setRows(result.data.campaigns);
    setNextCursor(result.data.nextCursor);
    setState('ready');
  }, []);

  useEffect(() => { void loadFirstPage(filters); }, [filters, loadFirstPage]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadMoreInFlight.current || state === 'loading') return;
    loadMoreInFlight.current = true;
    const mine = generation.current;
    setLoadingMore(true);
    setMoreFailed(false);
    try {
      const result = await fetchCampaignPage(filtersToApiQuery(filters, nextCursor));
      if (mine !== generation.current) return;
      if (!result.ok) {
        // A cursor the server no longer accepts means the position is stale: start again from the top.
        if (result.code === 'invalid_cursor') void loadFirstPage(filters, true);
        else setMoreFailed(true);
        return;
      }
      setRows(previous => {
        const seen = new Set(previous.map(row => row.id));
        return [...previous, ...result.data.campaigns.filter(row => !seen.has(row.id))];
      });
      setNextCursor(result.data.nextCursor);
    } finally {
      loadMoreInFlight.current = false;
      setLoadingMore(false);
    }
  }, [filters, loadFirstPage, nextCursor, state]);

  const applyFilters = useCallback((next: Filters) => {
    // A fresh object so re-applying identical filters still refreshes. Changing filters always restarts pagination.
    setFilters({ ...next });
    const query = filtersToUrlQuery(next);
    window.history.replaceState(null, '', query ? `?${query}` : window.location.pathname);
  }, []);

  const reload = useCallback(() => loadFirstPage(filters, true), [filters, loadFirstPage]);

  return { filters, rows, nextCursor, state, loadingMore, moreFailed, applyFilters, loadMore, reload };
}
