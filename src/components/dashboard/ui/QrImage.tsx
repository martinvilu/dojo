"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/**
 * QR generado en el navegador. Antes la imagen la armaba api.qrserver.com:
 * cada rotación le mandaba a un tercero el curso, la clase y el código vigente.
 */
export function QrImage({ value, size = 192, alt }: { value: string; size?: number; alt: string }) {
  const [src, setSrc] = useState<{ value: string; url: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(value, { width: size, margin: 1, errorCorrectionLevel: "M" })
      .then((url) => { if (!cancelled) setSrc({ value, url }); })
      .catch(() => { if (!cancelled) setSrc(null); });
    return () => { cancelled = true; };
  }, [value, size]);

  if (!src) return <div role="img" aria-label={alt} style={{ width: size, height: size }} className="bg-neutral-100 animate-pulse rounded" />;
  // eslint-disable-next-line @next/next/no-img-element -- data URL generada localmente
  return <img src={src.url} alt={alt} width={size} height={size} />;
}
