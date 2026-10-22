"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

/** Segmentos de una URL `/{asignatura}/{anio}/{cuatrimestre}/{comision}/…`. */
export interface SemanticRoute {
  asignatura: string;
  anio: string;
  cuatrimestre: string;
  comision: string;
  /** Subpestaña del dashboard que corresponde a la vista. */
  subTab: string;
  studentPublicId?: string;
  practica?: string;
}

interface DeepLinkState {
  route: SemanticRoute | null;
  /** Estudiante a destacar al abrir su ficha (uid resuelto por el backend). */
  focusStudentId: string | null;
  setFocusStudentId: (id: string | null) => void;
}

const DeepLinkContext = createContext<DeepLinkState>({ route: null, focusStudentId: null, setFocusStudentId: () => {} });

export function DeepLinkProvider({ route, children }: { route: SemanticRoute; children: ReactNode }) {
  const [focusStudentId, setFocusStudentId] = useState<string | null>(null);
  return (
    <DeepLinkContext.Provider value={{ route, focusStudentId, setFocusStudentId }}>
      {children}
    </DeepLinkContext.Provider>
  );
}

export function useDeepLinkContext() {
  return useContext(DeepLinkContext);
}
