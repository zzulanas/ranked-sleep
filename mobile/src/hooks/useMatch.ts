import { useState, useEffect, useCallback, useRef } from 'react';
import { getTodayMatch, Match } from '../services/api';

const POLL_INTERVAL_MS = 30_000;

interface UseMatchResult {
  match: Match | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useMatch(userId: string | undefined): UseMatchResult {
  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchMatch = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    try {
      const result = await getTodayMatch(userId);
      setMatch(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load match');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchMatch();

    // Only poll while match is pending
    const startPolling = () => {
      intervalRef.current = setInterval(async () => {
        if (match?.status !== 'pending') {
          // Stop polling once resolved or voided
          if (intervalRef.current) clearInterval(intervalRef.current);
          return;
        }
        await fetchMatch();
      }, POLL_INTERVAL_MS);
    };

    startPolling();

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-evaluate polling when match status changes
  useEffect(() => {
    if (match?.status !== 'pending' && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [match?.status]);

  return { match, loading, error, refresh: fetchMatch };
}
