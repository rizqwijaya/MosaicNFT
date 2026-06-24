import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

type ToastKind = "pending" | "success" | "error";
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastCtx {
  push: (kind: ToastKind, message: string) => number;
  update: (id: number, kind: ToastKind, message: string) => void;
  dismiss: (id: number) => void;
}

const Ctx = createContext<ToastCtx | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = nextId++;
      setToasts((t) => [...t, { id, kind, message }]);
      if (kind !== "pending") setTimeout(() => dismiss(id), 6000);
      return id;
    },
    [dismiss]
  );

  const update = useCallback(
    (id: number, kind: ToastKind, message: string) => {
      setToasts((t) =>
        t.map((x) => (x.id === id ? { ...x, kind, message } : x))
      );
      if (kind !== "pending") setTimeout(() => dismiss(id), 6000);
    },
    [dismiss]
  );

  return (
    <Ctx.Provider value={{ push, update, dismiss }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex w-[min(92vw,360px)] flex-col gap-2">
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onClose={() => dismiss(t.id)} />
        ))}
      </div>
    </Ctx.Provider>
  );
}

function ToastCard({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const icon =
    toast.kind === "pending" ? (
      <span className="size-2.5 animate-ping rounded-full bg-brand-500" />
    ) : toast.kind === "success" ? (
      <span className="text-brand-500">✓</span>
    ) : (
      <span className="text-red-500">✕</span>
    );

  return (
    <div className="card tile-enter flex items-start gap-3 p-3.5 shadow-lg shadow-black/5">
      <div className="mt-0.5 flex size-5 items-center justify-center">{icon}</div>
      <div className="flex-1 text-sm">
        <div className="font-medium capitalize">
          {toast.kind === "pending"
            ? "Transaction pending"
            : toast.kind === "success"
              ? "Confirmed"
              : "Failed"}
        </div>
        <div className="text-stone-500 dark:text-stone-400">{toast.message}</div>
      </div>
      <button
        onClick={onClose}
        className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
      >
        ✕
      </button>
    </div>
  );
}
