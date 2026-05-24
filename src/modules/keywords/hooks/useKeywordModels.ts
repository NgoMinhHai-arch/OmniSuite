"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getLlmCredentialsFromSettings } from "@/shared/lib/client-llm-credentials";
import { getDashboardLlmProviderFromSettings } from "@/shared/lib/llm-default-provider";
import { fetchWithRetry } from "@/modules/keywords/lib/fetch-with-retry";

const SETTINGS_KEY = "omnisuite_settings";

function isAuthOrKeyError(status: number, message: string): boolean {
  if (status === 401 || status === 403) return true;
  const lower = message.toLowerCase();
  return (
    lower.includes("api key") ||
    lower.includes("expired") ||
    lower.includes("invalid") ||
    lower.includes("unauthorized")
  );
}

export function useKeywordModels(onRateLimitMessage?: (msg: string) => void) {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [provider, setProvider] = useState("google");
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [isFetchModelsLoading, setIsFetchModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);

  const onRateLimitRef = useRef(onRateLimitMessage);
  onRateLimitRef.current = onRateLimitMessage;

  useEffect(() => {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (!saved) return;
    const parsed = JSON.parse(saved) as Record<string, string>;
    setSettings(parsed);
    setProvider(getDashboardLlmProviderFromSettings(parsed));
  }, []);

  const buildAiApiKeys = useCallback(
    () => ({
      gemini: settings.gemini_api_key,
      openai: settings.openai_api_key,
      groq: settings.groq_api_key,
      openrouter: settings.openrouter_api_key,
      claude: settings.claude_api_key,
      deepseek: settings.deepseek_api_key,
      ollama: settings.ollama_api_key || "ollama",
      ollama_base_url: settings.ollama_base_url,
      ninerouter: settings.ninerouter_api_key || "9router",
      ninerouter_base_url: settings.ninerouter_base_url,
    }),
    [settings],
  );

  const fetchModels = useCallback(async () => {
    const { apiKey, customBaseUrl } = getLlmCredentialsFromSettings(provider, settings);
    if (provider !== "ollama" && provider !== "9router" && !apiKey) {
      setAvailableModels([]);
      setSelectedModel("");
      setModelsError(null);
      return;
    }
    setIsFetchModelsLoading(true);
    setModelsError(null);
    try {
      const listResp = await fetchWithRetry(
        "/api/list-models",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider,
            apiKey: apiKey || (provider === "9router" ? "9router" : "ollama"),
            ...(customBaseUrl ? { customBaseUrl } : {}),
          }),
        },
        10,
        (msg) => onRateLimitRef.current?.(msg),
      );
      const listData = (await listResp.json().catch(() => ({}))) as {
        models?: string[];
        error?: string;
      };

      if (listResp.ok && Array.isArray(listData.models) && listData.models.length > 0) {
        setAvailableModels(listData.models);
        setSelectedModel(listData.models[0]);
        return;
      }

      const errMsg = listData.error || "Không thể tải danh sách model";
      if (isAuthOrKeyError(listResp.status, errMsg)) {
        setModelsError(
          errMsg.includes("expired") || errMsg.toLowerCase().includes("api key")
            ? "API key hết hạn hoặc không hợp lệ. Vào Settings → cập nhật key Gemini (hoặc provider đang chọn)."
            : errMsg,
        );
      } else {
        setModelsError(errMsg);
      }
      setAvailableModels([]);
      setSelectedModel("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Không thể tải danh sách model";
      console.error("Failed to load models", err);
      setModelsError(message);
      setAvailableModels([]);
      setSelectedModel("");
    } finally {
      setIsFetchModelsLoading(false);
    }
  }, [provider, settings]);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  return {
    settings,
    provider,
    setProvider,
    availableModels,
    selectedModel,
    setSelectedModel,
    isFetchModelsLoading,
    modelsError,
    buildAiApiKeys,
    fetchWithRetry: (url: string, options?: RequestInit, maxRetries?: number) =>
      fetchWithRetry(url, options, maxRetries, (msg) => onRateLimitRef.current?.(msg)),
  };
}
