"use client";
import React, { useEffect, use } from "react";
import { useRouter } from "next/navigation";

export default function CourseDetailPage({ params }: { params: Promise<{ id: string, slug?: string[] }> }) {
  const router = useRouter();
  const resolvedParams = use(params);

  useEffect(() => {
    let url = `/dashboard?courseId=${resolvedParams.id}`;
    if (resolvedParams.slug && resolvedParams.slug.length > 0) {
      url += `&subTab=${resolvedParams.slug[0]}`;
    }
    router.push(url);
  }, [resolvedParams.id, resolvedParams.slug, router]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
      <div className="flex items-center space-x-2 text-gray-400 animate-pulse">
        <span className="w-4 h-4 border-2 border-t-transparent border-red-500 rounded-full animate-spin"></span>
        <span>Redireccionando a la cátedra en el Dojo...</span>
      </div>
    </div>
  );
}
