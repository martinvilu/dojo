"use client";
import React from "react";

export function GithubPromptModal(props: any) {
  const { githubPromptModal, setGithubPromptModal, showToast } = props;
  const [inputVal, setInputVal] = React.useState("");

  if (!githubPromptModal?.isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[99999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl max-w-sm w-full min-w-[280px] sm:min-w-[380px] shrink-0 mx-auto text-center space-y-5 shadow-2xl relative z-10 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-bold text-white font-sans">Vincular cuenta de GitHub</h3>
        <p className="text-xs text-gray-400 font-sans">
          ¡Hola! Has ingresado a Ninja Dojo desde Moodle por primera vez.<br/>
          Para poder crear y sincronizar tu repositorio de tareas, por favor ingresa tu usuario de GitHub:
        </p>
        <input
          type="text"
          value={inputVal}
          placeholder="Nombre de usuario de GitHub"
          className="w-full bg-neutral-950 border border-neutral-850 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500 font-sans"
          onChange={(e) => setInputVal(e.target.value)}
        />
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => {
              githubPromptModal.resolve(null);
              setGithubPromptModal(null);
            }}
            className="flex-1 px-4 py-2 bg-neutral-850 hover:bg-neutral-800 border border-neutral-800 text-xs font-bold text-gray-300 rounded-xl transition cursor-pointer font-sans"
          >
            Omitir por ahora
          </button>
          <button
            type="button"
            onClick={() => {
              const val = inputVal.trim();
              if (val) {
                githubPromptModal.resolve(val);
                setGithubPromptModal(null);
              } else {
                showToast("Por favor ingresa un usuario válido.", "success");
              }
            }}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition cursor-pointer font-sans"
          >
            Vincular Perfil
          </button>
        </div>
      </div>
    </div>
  );
}
