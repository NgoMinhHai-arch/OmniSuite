"use client";

import { useState } from "react";
import { Upload, Download, Image as ImageIcon } from "lucide-react";
import { ToolShell } from "@/components/seo/ToolShell";

export default function EcommerceImageCenteringPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [bg, setBg] = useState("#ffffff");
  const [padding, setPadding] = useState(40);
  const [size, setSize] = useState(1000);
  const [busy, setBusy] = useState(false);

  const handleFiles = (list: FileList | null) => {
    if (!list) return;
    setFiles(Array.from(list).filter((f) => f.type.startsWith("image/")));
  };

  const processOne = async (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas error"));
          return;
        }
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, size, size);
        const maxInner = size - padding * 2;
        const ratio = Math.min(maxInner / img.width, maxInner / img.height);
        const w = img.width * ratio;
        const h = img.height * ratio;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        URL.revokeObjectURL(url);
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob"))), "image/jpeg", 0.9);
      };
      img.onerror = reject;
      img.src = url;
    });
  };

  const downloadAll = async () => {
    setBusy(true);
    try {
      for (const file of files) {
        const blob = await processOne(file);
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = file.name.replace(/\.[^.]+$/, "") + "-centered.jpg";
        a.click();
        URL.revokeObjectURL(a.href);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolShell
      title="E-commerce Image Centering"
      description="Tự động đặt ảnh sản phẩm vào canvas vuông, căn giữa, có padding và background tuỳ chỉnh — chạy hoàn toàn trong trình duyệt."
      requires={[]}
    >
      <div className="rounded-2xl p-6 space-y-4" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
        <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl py-10 cursor-pointer text-sm font-bold"
          style={{ borderColor: "rgba(6,182,212,0.25)", color: "var(--text-secondary)" }}>
          <Upload size={28} className="text-cyan-400" />
          {files.length > 0 ? `${files.length} ảnh đã chọn` : "Click để chọn ảnh (đa chọn)"}
          <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="text-sm font-bold" style={{ color: "var(--text-secondary)" }}>
            Kích thước (px)
            <input type="number" value={size} onChange={(e) => setSize(Math.max(200, Math.min(3000, Number(e.target.value) || 1000)))}
              className="mt-1 w-full rounded-lg px-3 py-2 text-sm font-mono"
              style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }} />
          </label>
          <label className="text-sm font-bold" style={{ color: "var(--text-secondary)" }}>
            Padding (px)
            <input type="number" value={padding} onChange={(e) => setPadding(Math.max(0, Math.min(400, Number(e.target.value) || 0)))}
              className="mt-1 w-full rounded-lg px-3 py-2 text-sm font-mono"
              style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }} />
          </label>
          <label className="text-sm font-bold" style={{ color: "var(--text-secondary)" }}>
            Background
            <input type="color" value={bg} onChange={(e) => setBg(e.target.value)} className="mt-1 w-full h-10 rounded-lg cursor-pointer" />
          </label>
        </div>

        <button
          onClick={downloadAll}
          disabled={files.length === 0 || busy}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold"
        >
          <Download size={16} /> {busy ? "Đang xử lý..." : "Tải về tất cả"}
        </button>
      </div>

      {files.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {files.slice(0, 12).map((f, i) => (
            <div key={i} className="rounded-xl p-2 text-center" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.12)" }}>
              <div className="aspect-square rounded-lg overflow-hidden flex items-center justify-center" style={{ backgroundColor: bg }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={URL.createObjectURL(f)} alt={f.name} className="max-w-full max-h-full" />
              </div>
              <p className="text-[10px] truncate mt-1 flex items-center gap-1 justify-center" style={{ color: "var(--text-muted)" }}>
                <ImageIcon size={10} /> {f.name}
              </p>
            </div>
          ))}
        </div>
      )}
    </ToolShell>
  );
}
