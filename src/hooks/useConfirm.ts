import { useState, useCallback, useRef } from "react";

interface ConfirmState {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  variant: "danger" | "warning";
  onConfirm: () => void;
}

const defaultState: ConfirmState = {
  open: false,
  title: "",
  message: "",
  confirmLabel: "Delete",
  variant: "danger",
  onConfirm: () => {},
};

export function useConfirm() {
  const [state, setState] = useState<ConfirmState>(defaultState);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback(
    (opts: {
      title: string;
      message: string;
      confirmLabel?: string;
      variant?: "danger" | "warning";
    }): Promise<boolean> => {
      return new Promise((resolve) => {
        resolveRef.current = resolve;
        setState({
          open: true,
          title: opts.title,
          message: opts.message,
          confirmLabel: opts.confirmLabel || "Delete",
          variant: opts.variant || "danger",
          onConfirm: () => {
            setState(defaultState);
            resolveRef.current = null;
            resolve(true);
          },
        });
      });
    },
    []
  );

  const cancel = useCallback(() => {
    if (resolveRef.current) {
      resolveRef.current(false);
      resolveRef.current = null;
    }
    setState(defaultState);
  }, []);

  return { state, confirm, cancel };
}
