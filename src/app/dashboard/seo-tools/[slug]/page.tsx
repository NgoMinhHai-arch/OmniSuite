"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { LlmTextTool } from "@/components/seo/LlmTextTool";
import { getLlmToolPreset } from "@/lib/seo/llm-tool-presets";
import { findTool } from "@/lib/seo/tool-registry";

type Props = {
  params: Promise<{ slug: string }>;
};

export default function DynamicLlmSeoToolPage({ params }: Props) {
  const { slug } = use(params);
  const meta = findTool(slug);
  const preset = meta ? getLlmToolPreset(meta.slug) : undefined;

  if (!meta || !preset) {
    notFound();
  }

  return <LlmTextTool title={meta.title} description={meta.description} {...preset} />;
}
