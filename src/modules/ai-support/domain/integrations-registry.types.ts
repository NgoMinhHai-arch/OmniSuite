/**
 * Types for integrations registry (manifest SSOT → generated data).
 */

export type IntegrationKind = 'python-cli' | 'python-script' | 'node-app' | 'docker-app';
export type IntegrationStrategy = 'ai-support-runner' | 'external-app';

export interface IntegrationEntry {
  id: string;
  name: string;
  path: string;
  kind: IntegrationKind;
  integrationStrategy: IntegrationStrategy;
  features: string[];
  setupHint: string;
  slashCommand?: string;
  probe?: { bin: string; args: string[] };
}
