import { useParams } from "react-router-dom";
import { useQuery } from "urql";
import { COLLECTION_TOKENS } from "../lib/queries";
import { Masonry, EmptyState } from "../components/Masonry";
import { NftCard } from "../components/NftCard";
import { CardSkeletonGrid } from "../components/Skeleton";
import { shortAddr } from "../lib/format";
import type { GqlToken } from "../lib/types";

export default function Collection() {
  const { address } = useParams();
  const id = (address ?? "").toLowerCase();
  const [res] = useQuery<{
    collection: { id: string; name?: string; tokens: GqlToken[] } | null;
  }>({
    query: COLLECTION_TOKENS,
    variables: { id, first: 100 },
  });

  const col = res.data?.collection;

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold">
          {col?.name || "MosaicNFT Collection"}
        </h1>
        <div className="mt-1 text-sm text-stone-500">{shortAddr(id)}</div>
      </div>

      {res.fetching ? (
        <CardSkeletonGrid count={6} />
      ) : !col || col.tokens.length === 0 ? (
        <EmptyState title="No tokens minted yet" />
      ) : (
        <Masonry>
          {col.tokens.map((t, i) => (
            <NftCard
              key={t.id}
              index={i}
              to={`/item/${id}/${t.tokenId}`}
              tokenURI={t.tokenURI}
              price={t.listing?.active ? t.listing.price : null}
              fallbackName={`#${t.tokenId}`}
            />
          ))}
        </Masonry>
      )}
    </div>
  );
}
