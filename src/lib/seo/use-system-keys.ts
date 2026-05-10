"use client";

import { useEffect, useState } from "react";
import { REQUIREMENTS, RequirementKey } from "./tool-registry";

const SETTINGS_KEY = "omnisuite_settings";

export interface SystemKeysState {
  /** Local settings JSON (subset of fields we care about). */
  local: Record<string, string | boolean>;
  /** Trường đã có hiệu lực: dashboard (localStorage) hoặc .env — từ POST /api/system/status `merged`. */
  server: Record<string, boolean>;
  loaded: boolean;
}

function readLocal(): Record<string, string | boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, string | boolean>;
  } catch {
    return {};
  }
}

export function useSystemKeys(): SystemKeysState & {
  hasRequirement: (req: RequirementKey) => boolean;
  missing: (reqs: RequirementKey[]) => RequirementKey[];
} {
  const [state, setState] = useState<SystemKeysState>({ local: {}, server: {}, loaded: false });

  useEffect(() => {
    const local = readLocal();
    setState((s) => ({ ...s, local }));

    let cancelled = false;

    async function fetchMerged(): Promise<Record<string, boolean>> {
      const keys = readLocal();
      const r = await fetch("/api/system/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keys }),
      });
      if (!r.ok) return {};
      const data = (await r.json().catch(() => ({}))) as { merged?: Record<string, boolean> };
      return data?.merged && typeof data.merged === "object" ? data.merged : {};
    }

    fetchMerged()
      .then((merged) => {
        if (cancelled) return;
        setState({ local: readLocal(), server: merged, loaded: true });
      })
      .catch(() => {
        if (cancelled) return;
        setState((s) => ({ ...s, loaded: true }));
      });

    function onStorage(e: StorageEvent) {
      if (e.key !== SETTINGS_KEY) return;
      const loc = readLocal();
      setState((s) => ({ ...s, local: loc }));
      fetchMerged().then((merged) => {
        setState({ local: readLocal(), server: merged, loaded: true });
      });
    }
    window.addEventListener("storage", onStorage);
    return () => {
      cancelled = true;
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  function fieldHasValue(field: string): boolean {
    const localVal = state.local[field];
    if (typeof localVal === "string" && localVal.trim().length > 0) return true;
    if (typeof localVal === "boolean" && localVal) return true;
    if (state.server[field]) return true;
    return false;
  }

  function hasRequirement(req: RequirementKey): boolean {
    const meta = REQUIREMENTS[req];
    if (!meta) return false;

    // Composite requirements need ALL fields when more than one and labelled together
    if (req === "dataforseo") {
      return fieldHasValue("dataforseo_user") && fieldHasValue("dataforseo_pass");
    }
    if (req === "oncrawl") {
      return fieldHasValue("oncrawl_api_key") && fieldHasValue("oncrawl_project_id");
    }
    if (req === "woocommerce") {
      return (
        fieldHasValue("woo_consumer_key") &&
        fieldHasValue("woo_consumer_secret") &&
        fieldHasValue("woo_store_url")
      );
    }
    if (req === "gsc") {
      return fieldHasValue("gsc_service_account_key") || fieldHasValue("gsc_use_oauth");
    }
    if (req === "llm") {
      // Ollama local: chon "Ollama" lam mac dinh la du; URL/key co the de trong (mac dinh localhost:11434).
      const localVal = state.local["default_provider"];
      const defaultProvider =
        typeof localVal === "string" ? localVal.trim() : "";
      if (defaultProvider === "Ollama") return true;
      return meta.settingsKeys.some((f) => fieldHasValue(f));
    }
    return meta.settingsKeys.some((f) => fieldHasValue(f));
  }

  function missing(reqs: RequirementKey[]): RequirementKey[] {
    return reqs.filter((r) => !hasRequirement(r));
  }

  return { ...state, hasRequirement, missing };
}
