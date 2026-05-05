"use client";

import { useState } from "react";
import { Upload, Download, Loader2 } from "lucide-react";
import { ToolShell } from "@/components/seo/ToolShell";

export default function InjectBrandingPdfsPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [text, setText] = useState("Powered by Yourbrand.com");
  const [position, setPosition] = useState<"footer" | "header" | "watermark">("footer");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = (list: FileList | null) => {
    if (!list) return;
    setFiles(Array.from(list).filter((f) => f.type === "application/pdf"));
  };

  const stamp = async () => {
    setBusy(true);
    setError(null);
    try {
      const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
      for (const file of files) {
        const buf = await file.arrayBuffer();
        const pdf = await PDFDocument.load(buf);
        const font = await pdf.embedFont(StandardFonts.HelveticaBold);
        pdf.getPages().forEach((page) => {
          const { width, height } = page.getSize();
          const fontSize = 10;
          const textWidth = font.widthOfTextAtSize(text, fontSize);
          let x = 20;
          let y = 20;
          if (position === "header") y = height - 20;
          else if (position === "watermark") {
            x = (width - textWidth) / 2;
            y = height / 2;
          } else {
            x = (width - textWidth) / 2;
          }
          page.drawText(text, { x, y, size: position === "watermark" ? 36 : fontSize, font, color: rgb(0.04, 0.4, 0.5), opacity: position === "watermark" ? 0.18 : 0.85 });
        });
        const out = await pdf.save();
        const blob = new Blob([new Uint8Array(out)], { type: "application/pdf" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = file.name.replace(/\.pdf$/i, "") + "-branded.pdf";
        a.click();
        URL.revokeObjectURL(a.href);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolShell
      title="Inject Branding into PDFs"
      description="Stamp text branding (footer, header, hoặc watermark) vào PDF. Chạy hoàn toàn trong trình duyệt — không upload file."
      requires={[]}
    >
      <div className="rounded-2xl p-6 space-y-3" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
        <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl py-8 cursor-pointer text-sm font-bold"
          style={{ borderColor: "rgba(6,182,212,0.25)", color: "var(--text-secondary)" }}>
          <Upload size={28} className="text-cyan-400" />
          {files.length ? `${files.length} PDF đã chọn` : "Chọn PDF (đa file)"}
          <input type="file" accept="application/pdf" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
        </label>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Text branding"
          className="w-full rounded-xl px-4 py-2.5 text-sm font-bold"
          style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }} />
        <div className="flex items-center gap-3">
          <select value={position} onChange={(e) => setPosition(e.target.value as "footer" | "header" | "watermark")}
            className="rounded-xl px-3 py-2.5 text-sm font-bold"
            style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }}>
            <option value="footer">Footer</option>
            <option value="header">Header</option>
            <option value="watermark">Watermark</option>
          </select>
          <button onClick={stamp} disabled={busy || !files.length}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            {busy ? "Đang stamp..." : "Stamp & tải"}
          </button>
        </div>
        {error && <p className="text-sm text-rose-400">{error}</p>}
      </div>
    </ToolShell>
  );
}
