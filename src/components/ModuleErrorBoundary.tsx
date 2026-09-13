"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { logger } from "@/lib/logger";

interface Props {
  moduleName?: string;
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ModuleErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error(
      `Unhandled crash in module: ${this.props.moduleName || "UnknownModule"}`,
      error,
      { componentStack: errorInfo.componentStack }
    );
  }

  public handleRetry = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          role="alert"
          aria-live="assertive"
          className="p-6 bg-red-955/20 border border-red-900/40 rounded-2xl space-y-4 my-4 text-center max-w-xl mx-auto font-sans"
        >
          <div className="w-12 h-12 rounded-full bg-red-950/60 border border-red-800/60 flex items-center justify-center mx-auto text-red-400 text-xl font-bold">
            ⚠️
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white">
              Error al cargar {this.props.moduleName ? `el módulo "${this.props.moduleName}"` : "este módulo"}
            </h3>
            <p className="text-xs text-gray-400">
              Ocurrió un problema inesperado al procesar los datos de esta sección. Puedes reintentar sin recargar toda la plataforma.
            </p>
          </div>

          {this.state.error && (
            <details className="text-left bg-neutral-950/80 p-3 rounded-lg border border-neutral-850 text-[11px] font-mono text-red-300/80 overflow-x-auto">
              <summary className="cursor-pointer text-gray-500 hover:text-gray-400 font-sans select-none">
                Detalles técnicos del error
              </summary>
              <pre className="mt-2 whitespace-pre-wrap">{this.state.error.message}</pre>
            </details>
          )}

          <div className="pt-2">
            <button
              type="button"
              onClick={this.handleRetry}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition cursor-pointer shadow"
            >
              🔄 Reintentar módulo
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
