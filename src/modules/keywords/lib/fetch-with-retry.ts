/** Retry fetch khi 429 (quota) — dùng chung keywords dashboard. */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries = 10,
  onRateLimitMessage?: (msg: string) => void,
): Promise<Response> {
  let retries = 0;
  while (retries < maxRetries) {
    const response = await fetch(url, options);
    if (response.status === 429) {
      const rawText = await response.clone().text().catch(() => "");
      let errorData: { error?: { message?: string }; ERROR?: { MESSAGE?: string } } = {};
      try {
        errorData = JSON.parse(rawText) as typeof errorData;
      } catch {
        /* ignore */
      }

      let delay = 5000;
      const msg = errorData.error?.message || errorData.ERROR?.MESSAGE || rawText || "";
      const match = msg.match(/RETRY IN ([\d.]+)S/i);
      if (match) {
        delay = (parseFloat(match[1]) + 2) * 1000;
      }

      onRateLimitMessage?.(`Hệ thống đang bận (429 Quota). Đang thử lại trong ${Math.round(delay / 1000)}s...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      retries++;
      continue;
    }
    return response;
  }
  return fetch(url, options);
}
