import { useCallback } from "react";
import { parseEther } from "viem";
import { useTx } from "./useTx";
import {
  MOSAIC_ERC721,
  MOSAIC_MARKET,
  erc721Abi,
  marketAbi,
} from "../lib/contracts";
import type { Voucher } from "../lib/types";

/**
 * All marketplace write actions, each wrapped with tx toasts. Pass an
 * onConfirmed callback to refetch subgraph data after confirmation.
 */
export function useMarket(onConfirmed?: () => void) {
  const tx = useTx(onConfirmed);

  const approveCollection = useCallback(
    () =>
      tx.run("Approving marketplace", {
        address: MOSAIC_ERC721,
        abi: erc721Abi,
        functionName: "setApprovalForAll",
        args: [MOSAIC_MARKET, true],
      }),
    [tx]
  );

  const mint = useCallback(
    (to: `0x${string}`, uri: string, royaltyBps: number) =>
      tx.run("Minting NFT", {
        address: MOSAIC_ERC721,
        abi: erc721Abi,
        functionName: "mintTo",
        args: [to, uri, BigInt(royaltyBps)],
      }),
    [tx]
  );

  const list = useCallback(
    (tokenId: bigint, priceEth: string) =>
      tx.run("Listing item", {
        address: MOSAIC_MARKET,
        abi: marketAbi,
        functionName: "listItem",
        args: [MOSAIC_ERC721, tokenId, parseEther(priceEth)],
      }),
    [tx]
  );

  const cancelListing = useCallback(
    (tokenId: bigint) =>
      tx.run("Cancelling listing", {
        address: MOSAIC_MARKET,
        abi: marketAbi,
        functionName: "cancelListing",
        args: [MOSAIC_ERC721, tokenId],
      }),
    [tx]
  );

  const buy = useCallback(
    (tokenId: bigint, priceWei: bigint) =>
      tx.run("Buying item", {
        address: MOSAIC_MARKET,
        abi: marketAbi,
        functionName: "buyItem",
        args: [MOSAIC_ERC721, tokenId],
        value: priceWei,
      }),
    [tx]
  );

  const buyLazy = useCallback(
    (voucher: Voucher, payWei: bigint) =>
      tx.run("Minting & buying", {
        address: MOSAIC_MARKET,
        abi: marketAbi,
        functionName: "buyLazy",
        args: [
          MOSAIC_ERC721,
          {
            nonce: BigInt(voucher.nonce),
            minPrice: BigInt(voucher.minPrice),
            uri: voucher.uri,
            royaltyBps: BigInt(voucher.royaltyBps),
            creator: voucher.creator as `0x${string}`,
            signature: voucher.signature as `0x${string}`,
          },
        ],
        value: payWei,
      }),
    [tx]
  );

  const createAuction = useCallback(
    (tokenId: bigint, startPriceEth: string, durationSec: number) =>
      tx.run("Creating auction", {
        address: MOSAIC_MARKET,
        abi: marketAbi,
        functionName: "createAuction",
        args: [MOSAIC_ERC721, tokenId, parseEther(startPriceEth), BigInt(durationSec)],
      }),
    [tx]
  );

  const placeBid = useCallback(
    (auctionId: bigint, bidEth: string) =>
      tx.run("Placing bid", {
        address: MOSAIC_MARKET,
        abi: marketAbi,
        functionName: "placeBid",
        args: [auctionId],
        value: parseEther(bidEth),
      }),
    [tx]
  );

  const settleAuction = useCallback(
    (auctionId: bigint) =>
      tx.run("Settling auction", {
        address: MOSAIC_MARKET,
        abi: marketAbi,
        functionName: "settleAuction",
        args: [auctionId],
      }),
    [tx]
  );

  const makeOffer = useCallback(
    (tokenId: bigint, amountEth: string) =>
      tx.run("Making offer", {
        address: MOSAIC_MARKET,
        abi: marketAbi,
        functionName: "makeOffer",
        args: [MOSAIC_ERC721, tokenId],
        value: parseEther(amountEth),
      }),
    [tx]
  );

  const cancelOffer = useCallback(
    (offerId: bigint) =>
      tx.run("Cancelling offer", {
        address: MOSAIC_MARKET,
        abi: marketAbi,
        functionName: "cancelOffer",
        args: [offerId],
      }),
    [tx]
  );

  const acceptOffer = useCallback(
    (offerId: bigint) =>
      tx.run("Accepting offer", {
        address: MOSAIC_MARKET,
        abi: marketAbi,
        functionName: "acceptOffer",
        args: [offerId],
      }),
    [tx]
  );

  const withdraw = useCallback(
    () =>
      tx.run("Withdrawing proceeds", {
        address: MOSAIC_MARKET,
        abi: marketAbi,
        functionName: "withdrawProceeds",
      }),
    [tx]
  );

  return {
    isPending: tx.isPending,
    status: tx.status,
    approveCollection,
    mint,
    list,
    cancelListing,
    buy,
    buyLazy,
    createAuction,
    placeBid,
    settleAuction,
    makeOffer,
    cancelOffer,
    acceptOffer,
    withdraw,
  };
}
