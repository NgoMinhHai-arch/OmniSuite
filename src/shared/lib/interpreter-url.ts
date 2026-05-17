/** URL Flask interpreter (search keywords, task heartbeat). Mặc định cổng 8081. */
export function getInterpreterUrl(): string {
  return process.env.INTERPRETER_URL || process.env.PYTHON_INTERPRETER_URL || "http://127.0.0.1:8081";
}
