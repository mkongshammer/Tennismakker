"use client";

import { useEffect, useRef } from "react";

// Opens a conversation at the latest message, and follows new ones.
export function ScrollToEnd({ count }: { count: number }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [count]);
  return <div ref={end} />;
}
