import { useCallback, useRef, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

// Ignore stale filter responses, retain loaded content on transient failures,
// and refresh after returning from the payment browser or another screen.
export function useScreenData(fetcher, { pollMs = 0 } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: true, refreshing: false });
  const sequence = useRef(0);
  const lastFetcher = useRef(null);
  const active = useRef(false);
  const inFlight = useRef(false);
  const load = useCallback(async (silent = false) => {
    if (!active.current || (silent && inFlight.current)) return;
    const version = ++sequence.current;
    inFlight.current = true;
    setState(s => ({ ...s, error: null, refreshing: !silent && Boolean(s.data) }));
    try {
      const data = await fetcher();
      if (active.current && version === sequence.current) setState({ data, error: null, loading: false, refreshing: false });
    } catch (error) {
      if (active.current && version === sequence.current) setState(s => ({ ...s, loading: false, refreshing: false, error: error.message }));
    } finally { if (version === sequence.current) inFlight.current = false; }
  }, [fetcher]);
  useFocusEffect(useCallback(() => {
    active.current = true;
    if (lastFetcher.current !== fetcher) {
      lastFetcher.current = fetcher;
      setState({ data: null, error: null, loading: true, refreshing: false });
    }
    load();
    const subscription = AppState.addEventListener("change", value => { if (value === "active") load(true); });
    const timer = pollMs ? setInterval(() => { if (AppState.currentState === "active") load(true); }, pollMs) : null;
    return () => { active.current = false; sequence.current++; inFlight.current = false; subscription.remove(); if (timer) clearInterval(timer); };
  }, [fetcher, load, pollMs]));
  const refresh = useCallback(() => load(false), [load]);
  return { ...state, refresh };
}
