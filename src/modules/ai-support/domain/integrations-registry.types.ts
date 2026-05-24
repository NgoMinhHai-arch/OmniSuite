/**
 * Types for integrations registry (manifest SSOT → generated data).
 */

export type IntegrationKind = 'python-cli' | 'python-script' | 'node-app' | 'docker-app';
export type IntegrationStrategy = 'ai-support-runner' | 'external-app';
export type IntegrationCategory =
  | 'runner'
  | 'career-app'
  | 'agent-framework'
  | 'resume'
  | 'web-stack'
  | 'reference';

export interface IntegrationEntry {
  id: string;
  name: string;
  path: string;
  kind: IntegrationKind;
  integrationStrategy: IntegrationStrategy;
  features: string[];
  setupHint: string;
  slashCommand?: string;
  repository?: string;
  cloneHint?: string;
  category?: IntegrationCategory;
  probe?: { bin: string; args: string[] };
}
