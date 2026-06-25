import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-gray-900">
      <main className="flex flex-col items-center space-y-6 text-center">
        <h1 className="text-4xl font-bold tracking-tight">Jutsu Classroom</h1>
        <p className="text-lg text-gray-600 max-w-md">
          Estamos migrando a una nueva plataforma más rápida y fluida. 
          Selecciona a dónde quieres ir:
        </p>
        <div className="flex gap-4 mt-4">
          <Link href="/index.html" className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition">
            Ir a la Versión Anterior (Legacy)
          </Link>
          <Link href="/login" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium">
            Iniciar Sesión (Nueva Versión)
          </Link>
        </div>
      </main>
    </div>
  );
}
