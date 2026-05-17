"use client";

import { useCallback, useEffect, useState } from "react";
import { getLlmCredentialsFromSettings } from "@/shared/lib/client-llm-credentials";
import { getDashboardLlmProviderFromSettings } from "@/shared/lib/llm-default-provider";
import { fetchWithRetry } from "@/modules/keywords/lib/fetch-with-retry";

const SETTINGS_KEY = "omnisuite_settings";

export function useKeywordModels(onRateLimitMessage?: (msg: string) => void) {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [provider, setProvider] = useState("google");
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [isFetchModelsLoading, setIsFetchModelsLoading] = useState(false);

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
    }),
    [settings],
  );

  const fetchModels = useCallback(async () => {
    const { apiKey, customBaseUrl } = getLlmCredentialsFromSettings(provider, settings);
    if (provider !== "ollama" && !apiKey) return;
    setIsFetchModelsLoading(true);
    try {
      let models: string[] = [];

      const listResp = await fetchWithRetry(
        "/api/list-models",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider,
            apiKey: apiKey || "ollama",
            ...(customBaseUrl ? { customBaseUrl } : {}),
          }),
        },
        10,
        onRateLimitMessage,
      );
      const listData = await listResp.json().catch(() => ({}));
      if (listResp.ok && Array.isArray(listData.models) && listData.models.length > 0) {
        models = listData.models;
      } else {
        const apiKeysParam = encodeURIComponent(JSON.stringify(buildAiApiKeys()));
        const legacyResp = await fetchWithRetry(
          `/api/seo/models?provider=${provider}&apiKeys=${apiKeysParam}`,
          {},
          10,
          onRateLimitMessage,
        );
        const legacyData = await legacyResp.json().catch(() => ({}));
        if (legacyResp.ok && Array.isArray(legacyData.models) && legacyData.models.length > 0) {
          models = legacyData.models;
        }
      }

      if (models.length > 0) {
        setAvailableModels(models);
        setSelectedModel(models[0]);
      } else {
        setAvailableModels([]);
        setSelectedModel("");
      }
    } catch (err) {
      console.error("Failed to load models", err);
      setAvailableModels([]);
      setSelectedModel("");
    } finally {
      setIsFetchModelsLoading(false);
    }
  }, [provider, settings, buildAiApiKeys, onRateLimitMessage]);

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
    buildAiApiKeys,
    fetchWithRetry: (url: string, options?: RequestInit, maxRetries?: number) =>
      fetchWithRetry(url, options, maxRetries, onRateLimitMessage),
  };
}
