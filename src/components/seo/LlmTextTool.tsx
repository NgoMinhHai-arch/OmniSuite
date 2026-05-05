"use client";

import React, { useState } from "react";
import { Loader2, Sparkles, Copy, Download } from "lucide-react";
import { ToolShell } from "./ToolShell";
import { runLlm, tryParseJson } from "@/lib/seo/llm-client";
import { downloadAsCsv } from "@/lib/seo/csv";

type RenderMode = "text" | "list" | "table";

interface FieldDef {
  name: string;
  label: string;
  rows?: number;
  placeholder?: string;
  required?: boolean;
}

interface LlmTextToolProps {
  title: string;
  description: string;
  systemPrompt: string;
  fields?: FieldDef[];
  /** Override the prompt builder; default joins all fields. */
  buildPrompt?: (values: Record<string, string>) => string;
  jsonMode?: boolean;
  /** When jsonMode true, optionally pick array path or transformer. */
  jsonExtractList?: (parsed: unknown) => Array<Record<string, string>>;
  listColumns?: string[];
  csvName?: string;
  renderMode?: RenderMode;
}

export function LlmTextTool({
  title,
  description,
  systemPrompt,
  fields = [{ name: "input", label: "Nội dung đầu vào", rows: 12, placeholder: "Dán nội dung..." }],
  buildPrompt,
  jsonMode = false,
  jsonExtractList,
  listColumns,
  csvName = "result.csv",
  renderMode = "text",
}: LlmTextToolProps) {
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((f) => [f.name, ""])));
  const [text, setText] = useState("");
  const [list, setList] = useState<Array<Record<string, string>>>([]);
  const [provider, setProvider] = useState<string>("");
  const [model, setModel] = useState<string>("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    setRunning(true);
    setError(null);
    setText("");
    setList([]);
    try {
      const missing = fields.filter((f) => f.required !== false && !values[f.name]?.trim());
      if (missing.length) {
        throw new Error(`Vui lòng nhập: ${missing.map((m) => m.label).join(", ")}`);
      }
      const prompt = buildPrompt
        ? buildPrompt(values)
        : fields.map((f) => `### ${f.label}\n${values[f.name] || ""}`).join("\n\n");

      const res = await runLlm({ system: systemPrompt, prompt, jsonMode });
      setProvider(res.provider);
      setModel(res.model);

      if (jsonMode && jsonExtractList) {
        const parsed = tryParseJson(res.text);
        if (!parsed) throw new Error("Không parse được JSON từ LLM. Nội dung thô:\n" + res.text);
        const rows = jsonExtractList(parsed);
        setList(rows);
      } else {
        setText(res.text);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setRunning(false);
    }
  };

  return (
    <ToolShell title={title} description={description} requires={["llm"]}>
      <div className="space-y-3">
        {fields.map((f) => (
          <div key={f.name} className="rounded-2xl p-4" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
            <label className="text-xs font-black uppercase block mb-2" style={{ color: "var(--text-muted)" }}>
              {f.label}{f.required !== false && <span className="text-rose-400 ml-1">*</span>}
            </label>
            <textarea
              value={values[f.name] || ""}
              onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
              rows={f.rows || 6}
              placeholder={f.placeholder}
              className="w-full rounded-xl px-4 py-3 text-sm resize-none"
              style={{ backgroundColor: "var(--hover-bg)", border: "1px solid rgba(6,182,212,0.2)", color: "var(--text-primary)" }}
            />
          </div>
        ))}
      </div>

      <button onClick={handleRun} disabled={running}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold">
        {running ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
        {running ? "Đang gọi LLM..." : "Chạy AI"}
      </button>

      {error && <p className="text-sm text-rose-400 whitespace-pre-wrap">{error}</p>}

      {(text || list.length > 0) && (
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--card-bg)", border: "1px solid rgba(6,182,212,0.16)" }}>
          <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: "rgba(6,182,212,0.1)" }}>
            <div>
              <h3 className="text-sm font-black uppercase" style={{ color: "var(--text-primary)" }}>Kết quả</h3>
              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{provider}/{model}</p>
            </div>
            <div className="flex gap-2">
              {text && (
                <button onClick={() => navigator.clipboard.writeText(text)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold">
                  <Copy size={12} /> Copy
                </button>
              )}
              {list.length > 0 && (
                <button
                  onClick={() => downloadAsCsv(csvName, listColumns || Object.keys(list[0] || {}), list.map((r) => (listColumns || Object.keys(r)).map((c) => r[c] ?? "")))}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                >
                  <Download size={12} /> CSV
                </button>
              )}
            </div>
          </div>
          {text && renderMode === "text" && (
            <pre className="p-4 text-sm whitespace-pre-wrap" style={{ color: "var(--text-secondary)" }}>{text}</pre>
          )}
          {list.length > 0 && (
            <table className="w-full text-sm">
              <thead className="text-xs font-black uppercase" style={{ color: "var(--text-muted)" }}>
                <tr>{(listColumns || Object.keys(list[0])).map((c) => <th key={c} className="text-left p-3">{c}</th>)}</tr>
              </thead>
              <tbody>
                {list.map((r, i) => (
                  <tr key={i} style={{ borderTop: "1px solid rgba(6,182,212,0.05)" }}>
                    {(listColumns || Object.keys(r)).map((c) => (
                      <td key={c} className="p-3" style={{ color: "var(--text-primary)" }}>{r[c]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </ToolShell>
  );
}
