/** URL Python Content/SEO engine (FastAPI, mặc định cổng 8082). */
export function getPythonEngineUrl(): string {
  return process.env.PYTHON_ENGINE_URL || "http://127.0.0.1:8082";
}
