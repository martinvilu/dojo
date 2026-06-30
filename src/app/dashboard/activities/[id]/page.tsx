import React from "react";

export default async function ActivityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-headline-lg font-bold text-on-surface mb-6">Detalle de Actividad</h1>
      <p className="text-body-md text-secondary">Visualizando la actividad con ID: {resolvedParams.id}</p>
      {/* TODO: Migrar la lógica de visualización y envíos (submissions) de la actividad */}
    </div>
  );
}
