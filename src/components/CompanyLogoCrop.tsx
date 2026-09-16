"use client";

import { useEffect, useRef, useState } from "react";

const OUTPUT_SIZE = 256;
const FRAME = 180;

type Props = {
  value: Blob | null;
  onChange: (blob: Blob | null) => void;
};

/** Square company logo crop → 256×256 PNG. Optional field for Add Client. */
export function CompanyLogoCrop({ value, onChange }: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [natural, setNatural] = useState({ w: 0, h: 0 });

  useEffect(() => {
    return () => {
      if (src) URL.revokeObjectURL(src);
    };
  }, [src]);

  async function onPick(file: File | null) {
    if (src) URL.revokeObjectURL(src);
    setSrc(null);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    onChange(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      throw new Error("Choose an image file (PNG, JPG, WebP)");
    }
    const url = URL.createObjectURL(file);
    setSrc(url);
  }

  function exportCrop() {
    const img = imgRef.current;
    if (!img || !natural.w) return;
    const scale = Math.max(FRAME / natural.w, FRAME / natural.h) * zoom;
    const drawW = natural.w * scale;
    const drawH = natural.h * scale;
    const dx = (FRAME - drawW) / 2 + offset.x;
    const dy = (FRAME - drawH) / 2 + offset.y;
    // Map frame (0..FRAME) into source image coords
    const sx = (-dx) / scale;
    const sy = (-dy) / scale;
    const sw = FRAME / scale;
    const sh = FRAME / scale;
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
    canvas.toBlob(
      (blob) => {
        if (blob) onChange(blob);
      },
      "image/png",
      0.92,
    );
  }

  useEffect(() => {
    if (!src || !natural.w) return;
    exportCrop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, zoom, offset.x, offset.y, natural.w, natural.h]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="w-full text-sm file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1.5"
          onChange={(e) => {
            void onPick(e.target.files?.[0] || null).catch((err) => {
              window.alert(err instanceof Error ? err.message : "Could not load image");
            });
          }}
        />
        {value || src ? (
          <button
            type="button"
            className="text-xs text-slate-600 underline-offset-2 hover:underline cursor-pointer"
            onClick={() => {
              if (src) URL.revokeObjectURL(src);
              setSrc(null);
              onChange(null);
            }}
          >
            Remove
          </button>
        ) : null}
      </div>
      <p className="text-[11px] text-slate-500">Square crop · exports {OUTPUT_SIZE}×{OUTPUT_SIZE}px PNG.</p>
      {src ? (
        <div className="space-y-2">
          <div
            className="relative mx-auto overflow-hidden rounded-md border border-slate-200 bg-slate-100 cursor-grab active:cursor-grabbing"
            style={{ width: FRAME, height: FRAME }}
            onPointerDown={(e) => {
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
            }}
            onPointerMove={(e) => {
              if (!drag.current) return;
              setOffset({
                x: drag.current.ox + (e.clientX - drag.current.x),
                y: drag.current.oy + (e.clientY - drag.current.y),
              });
            }}
            onPointerUp={() => {
              drag.current = null;
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={src}
              alt="Logo crop"
              draggable={false}
              className="absolute max-w-none pointer-events-none select-none"
              style={{
                width: natural.w ? natural.w * Math.max(FRAME / natural.w, FRAME / natural.h) * zoom : "auto",
                height: natural.h ? natural.h * Math.max(FRAME / natural.w, FRAME / natural.h) * zoom : "auto",
                left: "50%",
                top: "50%",
                transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
              }}
              onLoad={(e) => {
                const el = e.currentTarget;
                setNatural({ w: el.naturalWidth, h: el.naturalHeight });
              }}
            />
            <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-slate-400/80" />
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <span className="w-10 shrink-0">Zoom</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1"
            />
          </label>
          {value ? (
            <p className="text-[11px] text-emerald-700">Crop ready ({Math.round(value.size / 1024)} KB)</p>
          ) : null}
        </div>
      ) : (
        <div
          className="flex items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 text-[11px] text-slate-500"
          style={{ width: FRAME, height: FRAME }}
        >
          No logo
        </div>
      )}
    </div>
  );
}
