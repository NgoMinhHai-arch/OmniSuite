/** Lets non-React code (e.g. downloadAsCsv) request a gated download when a provider is mounted. */

export type DownloadGateFn = (run: () => void) => void;

let activeGate: DownloadGateFn | null = null;

export function registerDownloadRiddleGate(gate: DownloadGateFn | null) {
  activeGate = gate;
}

export function gatedDownload(run: () => void) {
  if (typeof window === "undefined") return;
  if (activeGate) {
    activeGate(run);
    return;
  }
  run();
}
