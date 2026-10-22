"use client";

import { use, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase/clientApp";

interface Item { id: string; title: string; text: string }

/**
 * Selector de LTI Deep Linking 2.0: el docente elige qué actividad del Dojo
 * insertar en Moodle; el servidor firma la respuesta y se devuelve por POST.
 */
export default function DeepLinkingPage({ searchParams }: { searchParams: Promise<{ session?: string }> }) {
  const { session } = use(searchParams);
  const [items, setItems] = useState<Item[]>([]);
  const [courseName, setCourseName] = useState("");
  const [acceptMultiple, setAcceptMultiple] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => onAuthStateChanged(auth, async (user) => {
    if (!user) return;
    try {
      const res = await fetch(`/api/v1/lti/deep_linking?session=${encodeURIComponent(session || "")}`, {
        headers: { Authorization: `Bearer ${await user.getIdToken()}` },
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      setItems(body.items);
      setCourseName(body.courseName);
      setAcceptMultiple(Boolean(body.acceptMultiple));
    } catch (err: any) {
      setError(err.message || "No se pudo cargar el contenido.");
    }
  }), [session]);

  const toggle = (id: string) => setSelected((prev) => {
    if (prev.includes(id)) return prev.filter((x) => x !== id);
    return acceptMultiple ? [...prev, id] : [id];
  });

  const submit = async () => {
    setSending(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/v1/lti/deep_linking", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ session, selected }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      const form = document.createElement("form");
      form.method = "POST";
      form.action = body.returnUrl;
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = "JWT";
      input.value = body.jwt;
      form.appendChild(input);
      document.body.appendChild(form);
      form.submit();
    } catch (err: any) {
      setError(err.message || "No se pudo enviar la selección.");
      setSending(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white p-4 sm:p-8">
      <div className="max-w-2xl mx-auto space-y-4">
        <h1 className="text-xl font-bold">Agregar actividad del Dojo{courseName ? ` · ${courseName}` : ""}</h1>
        {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
        <fieldset className="space-y-2">
          <legend className="text-sm text-gray-400 mb-2">{acceptMultiple ? "Elegí una o más actividades." : "Elegí una actividad."}</legend>
          {items.map((item) => (
            <label key={item.id} className={`flex gap-3 p-3 rounded-xl border cursor-pointer ${selected.includes(item.id) ? "border-blue-500 bg-neutral-900" : "border-neutral-800 bg-neutral-950"}`}>
              <input type={acceptMultiple ? "checkbox" : "radio"} name="item" checked={selected.includes(item.id)} onChange={() => toggle(item.id)} className="mt-1" />
              <span>
                <span className="block text-sm font-semibold">{item.title}</span>
                <span className="block text-xs text-gray-400">{item.text}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <button type="button" onClick={submit} disabled={sending || selected.length === 0}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-bold disabled:opacity-40 cursor-pointer">
          {sending ? "Enviando a Moodle…" : "Agregar a Moodle"}
        </button>
      </div>
    </main>
  );
}
