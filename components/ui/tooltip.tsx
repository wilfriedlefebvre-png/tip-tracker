"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface TooltipContextValue {
  showTooltip: string | null;
  setShowTooltip: (id: string | null) => void;
}

const TooltipContext = React.createContext<TooltipContextValue | undefined>(undefined);

function useTooltipContext() {
  const context = React.useContext(TooltipContext);
  if (!context) {
    return { showTooltip: null, setShowTooltip: () => {} };
  }
  return context;
}

export interface TooltipProviderProps {
  children: React.ReactNode;
}

const TooltipProvider: React.FC<TooltipProviderProps> = ({ children }) => {
  const [showTooltip, setShowTooltip] = React.useState<string | null>(null);
  return (
    <TooltipContext.Provider value={{ showTooltip, setShowTooltip }}>
      {children}
    </TooltipContext.Provider>
  );
};

export interface TooltipTriggerProps {
  asChild?: boolean;
  children: React.ReactNode;
}

const TooltipTrigger: React.FC<TooltipTriggerProps> = ({ asChild, children }) => {
  const { setShowTooltip } = useTooltipContext();
  const id = React.useId();

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      onMouseEnter: () => setShowTooltip(id),
      onMouseLeave: () => setShowTooltip(null),
    });
  }

  return (
    <div onMouseEnter={() => setShowTooltip(id)} onMouseLeave={() => setShowTooltip(null)}>
      {children}
    </div>
  );
};

export interface TooltipContentProps {
  children: React.ReactNode;
  className?: string;
}

const TooltipContent: React.FC<TooltipContentProps> = ({ children, className }) => {
  const { showTooltip, setShowTooltip } = useTooltipContext();
  const id = React.useId();
  const isVisible = showTooltip !== null;

  return (
    <>
      {isVisible && (
        <div
          className={cn(
            "z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95",
            className
          )}
          onMouseEnter={() => setShowTooltip(id)}
          onMouseLeave={() => setShowTooltip(null)}
        >
          {children}
        </div>
      )}
    </>
  );
};

export { TooltipProvider, TooltipTrigger, TooltipContent };

