import React from "react";

export default async function CourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-headline-lg font-bold text-on-surface mb-6">Detalle del Curso</h1>
      <p className="text-body-md text-secondary">Visualizando el curso con ID: {resolvedParams.id}</p>
      {/* TODO: Migrar la lógica de detalle del curso, incluyendo cronograma y configuración */}
    </div>
  );
}
