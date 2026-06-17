import { useEffect, useState } from "react";
import { fetchMetadata, type TokenMetadata } from "../lib/ipfs";

const cache = new Map<string, TokenMetadata | null>();

export function useMetadata(tokenURI?: string | null) {
  const [meta, setMeta] = useState<TokenMetadata | null>(() =>
    tokenURI ? (cache.get(tokenURI) ?? null) : null
  );
  const [loading, setLoading] = useState(!!tokenURI && !cache.has(tokenURI));

  useEffect(() => {
    if (!tokenURI) {
      setLoading(false);
      return;
    }
    if (cache.has(tokenURI)) {
      setMeta(cache.get(tokenURI)!);
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    fetchMetadata(tokenURI).then((m) => {
      cache.set(tokenURI, m);
      if (alive) {
        setMeta(m);
        setLoading(false);
      }
    });
    return () => {
      alive = false;
    };
  }, [tokenURI]);

  return { meta, loading };
}
