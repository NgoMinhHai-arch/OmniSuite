/** Bind address for local servers when OMNISUITE_LOCALHOST_ONLY is enabled (default). */
export function isLocalhostOnlyMode(): boolean {
  const v = (process.env.OMNISUITE_LOCALHOST_ONLY ?? '1').trim().toLowerCase();
  return v !== '0' && v !== 'false' && v !== 'no';
}

export function getBindHost(): '127.0.0.1' | '0.0.0.0' {
  return isLocalhostOnlyMode() ? '127.0.0.1' : '0.0.0.0';
}
