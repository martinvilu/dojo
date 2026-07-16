import React from "react";

interface ToastNotificationProps {
  message: string;
  type: "success" | "error" | "info";
  onClose: () => void;
}

export default function ToastNotification({ message, type, onClose }: ToastNotificationProps) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center space-x-3 bg-neutral-900 border border-neutral-800 px-4 py-3.5 rounded-xl shadow-2xl max-w-sm">
      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
        type === "success" ? "bg-emerald-500 shadow-md shadow-emerald-500/50" : type === "error" ? "bg-red-500 shadow-md shadow-red-500/50" : "bg-blue-500 shadow-md shadow-blue-500/50"
      }`}></span>
      <p className="text-xs text-gray-200 font-medium leading-normal">{message}</p>
      <button 
        type="button"
        onClick={onClose} 
        className="text-gray-500 hover:text-white text-xs font-bold pl-2 cursor-pointer transition-colors"
      >
        ✕
      </button>
    </div>
  );
}
