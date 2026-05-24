"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getLlmCredentialsFromSettings } from "@/shared/lib/client-llm-credentials";

const SETTINGS_KEY = "omnisuite_settings";

export type OpenRouterModelMeta = {
  id: string;
  displayName: string;
  isFree: boolean;
  inputCostPer1M: number;
  outputCostPer1M: number;
  contextWindow: number;
  modality: string;
  category: "balanced" | "reasoning" | "coding" | "fast" | "general";
};

export function useContentModels() {
  const [selectedProvider, setSelectedProvider] = useState("Gemini");
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [modelName, setModelName] = useState("");
  const [modelSearch, setModelSearch] = useState("");
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [openrouterCatalog, setOpenrouterCatalog] = useState<OpenRouterModelMeta[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [connectedProviders, setConnectedProviders] = useState<string[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const modelDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (!saved) return;
    const parsed = JSON.parse(saved) as Record<string, string>;
    setSettings(parsed);

    const connected: string[] = [];
    if (parsed.gemini_api_key) connected.push("Gemini");
    if (parsed.openai_api_key) connected.push("OpenAI");
    if (parsed.claude_api_key) connected.push("Claude");
    if (parsed.groq_api_key) connected.push("Groq");
    if (parsed.openrouter_api_key) connected.push("OpenRouter");
    if (parsed.deepseek_api_key) connected.push("DeepSeek");
    if (parsed.ollama_base_url?.trim() || parsed.ollama_api_key?.trim() || parsed.default_provider === "Ollama") {
      connected.push("Ollama");
    }
    setConnectedProviders(connected);

    const defaultProvider = parsed.default_provider || "Gemini";
    const resolvedProvider = connected.includes(defaultProvider) ? defaultProvider : connected[0] || defaultProvider;
    setSelectedProvider(resolvedProvider);

    if (parsed.default_model && resolvedProvider === defaultProvider) {
      setModelName(parsed.default_model);
    } else {
      setModelName("");
    }
  }, []);

  const fetchModels = useCallback(
    async (provider: string) => {
      const { apiKey, customBaseUrl } = getLlmCredentialsFromSettings(provider, settings);
      if (provider !== "Ollama" && !apiKey) return;

      setIsLoadingModels(true);
      try {
        const resp = await fetch("/api/list-models", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider,
            apiKey: apiKey || "ollama",
            ...(customBaseUrl ? { customBaseUrl } : {}),
          }),
        });
        const data = await resp.json();

        if (!resp.ok) {
          throw new Error(data.error || "Không thể tải danh sách model");
        }

        if (data.models && data.models.length > 0) {
          setAvailableModels(data.models);
          setOpenrouterCatalog(Array.isArray(data.openrouterCatalog) ? data.openrouterCatalog : []);
          setModelName((prev) => (data.models.includes(prev) ? prev : data.models[0]));
        } else {
          setOpenrouterCatalog([]);
        }
      } catch (err) {
        console.error("Fetch models error:", err);
        setOpenrouterCatalog([]);
      } finally {
        setIsLoadingModels(false);
      }
    },
    [settings],
  );

  useEffect(() => {
    const { apiKey } = getLlmCredentialsFromSettings(selectedProvider, settings);
    if (selectedProvider && (selectedProvider === "Ollama" || apiKey)) {
      fetchModels(selectedProvider);
    } else {
      setAvailableModels([]);
    }
    setIsModelDropdownOpen(false);
    setModelSearch("");
  }, [selectedProvider, settings, fetchModels]);

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      if (!modelDropdownRef.current) return;
      if (!modelDropdownRef.current.contains(event.target as Node)) {
        setIsModelDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  return {
    settings,
    setSettings,
    selectedProvider,
    setSelectedProvider,
    availableModels,
    modelName,
    setModelName,
    modelSearch,
    setModelSearch,
    isModelDropdownOpen,
    setIsModelDropdownOpen,
    openrouterCatalog,
    isLoadingModels,
    connectedProviders,
    modelDropdownRef,
    fetchModels,
  };
}
