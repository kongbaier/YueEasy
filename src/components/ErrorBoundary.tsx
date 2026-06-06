import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import { AlertTriangle, RotateCw } from "lucide-react";
import type { ReactNode } from "react";
import { Component } from "react";
import { cn } from "@/lib/utils";

interface ErrorFallbackProps {
  error: Error;
  reset: () => void;
  className?: string;
}

function DefaultErrorFallback({ error, reset, className }: ErrorFallbackProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 py-20",
        className,
      )}
    >
      <AlertTriangle className="h-10 w-10 text-muted-foreground" />
      <p className="text-sm text-muted-foreground max-w-md text-center">
        {error.message || "加载失败，请重试"}
      </p>
      <button
        className="inline-flex items-center gap-1.5 rounded bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        onClick={reset}
        type="button"
      >
        <RotateCw className="h-3.5 w-3.5" />
        重试
      </button>
    </div>
  );
}

type FallbackRender = (error: Error, reset: () => void) => ReactNode;

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: FallbackRender;
}

class ErrorBoundaryInner extends Component<
  ErrorBoundaryProps & { onReset: () => void },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  handleReset = () => {
    this.props.onReset();
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      const fb = this.props.fallback;
      return fb ? (
        fb(this.state.error, this.handleReset)
      ) : (
        <DefaultErrorFallback
          error={this.state.error}
          reset={this.handleReset}
        />
      );
    }
    return this.props.children;
  }
}

export function ErrorBoundary({ children, fallback }: ErrorBoundaryProps) {
  const { reset } = useQueryErrorResetBoundary();

  return (
    <ErrorBoundaryInner fallback={fallback} onReset={reset}>
      {children}
    </ErrorBoundaryInner>
  );
}
