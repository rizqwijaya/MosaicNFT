import { useCallback, useState } from "react";
import { useWriteContract, usePublicClient } from "wagmi";
import type { Abi } from "viem";
import { useToast } from "../components/Toast";
import { humanizeError } from "../lib/format";

interface WriteArgs {
  address: `0x${string}`;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
}

type TxStatus = "idle" | "pending" | "success" | "error";

/**
 * Wraps a contract write + receipt wait with human toasts and a status flag.
 * pending → confirmed → failed, with friendly messaging (no raw wallet errors).
 * onConfirmed runs after the receipt; use it to refetch subgraph data.
 */
export function useTx(onConfirmed?: () => void) {
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const toast = useToast();
  const [status, setStatus] = useState<TxStatus>("idle");

  const run = useCallback(
    async (label: string, args: WriteArgs) => {
      const toastId = toast.push("pending", `${label}… confirm in your wallet.`);
      setStatus("pending");
      try {
        const hash = await writeContractAsync(args);
        toast.update(toastId, "pending", `${label}… waiting for confirmation.`);
        await publicClient!.waitForTransactionReceipt({ hash });
        toast.update(toastId, "success", `${label} confirmed.`);
        setStatus("success");
        // give the subgraph a moment to index, then refetch
        if (onConfirmed) setTimeout(onConfirmed, 2500);
        return hash;
      } catch (err) {
        toast.update(toastId, "error", humanizeError(err));
        setStatus("error");
        return null;
      }
    },
    [writeContractAsync, publicClient, toast, onConfirmed]
  );

  return { run, status, isPending: status === "pending" };
}
