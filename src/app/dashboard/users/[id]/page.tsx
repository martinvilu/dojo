import React from "react";

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-headline-lg font-bold text-on-surface mb-6">Perfil de Usuario</h1>
      <p className="text-body-md text-secondary">Visualizando el perfil del usuario con ID: {resolvedParams.id}</p>
      {/* TODO: Mostrar información detallada, cursos inscritos y progreso del usuario */}
    </div>
  );
}
