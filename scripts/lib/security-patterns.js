/** Shared secret-detection patterns for security-scan and CI. */

const SECRET_ASSIGNMENT_REGEX =
  /(INTERNAL_TOKEN|NEXTAUTH_SECRET|SERPAPI_KEY|TAVILY_API_KEY|OPENAI_API_KEY|ANTHROPIC_API_KEY|GROQ_API_KEY|LLM_API_KEY|GEMINI_API_KEY|GOOGLE_API_KEY|OPENROUTER_API_KEY|DEEPSEEK_API_KEY|AI_SUPPORT_RUNNER_SECRET|OMNISUITE_INSTALL_SECRET|OMNISUITE_OWNER_KEY)\s*[:=]\s*["']?([^\s"'`]{8,})/gi;

const DIRECT_TOKEN_PATTERNS = [
  { label: 'OpenAI-like key (sk-...)', regex: /\bsk-[A-Za-z0-9]{20,}\b/g },
  { label: 'OpenRouter key (sk-or-v1-...)', regex: /\bsk-or-v1-[A-Za-z0-9]{20,}\b/g },
  { label: 'Groq key (gsk_...)', regex: /\bgsk_[A-Za-z0-9]{20,}\b/g },
  { label: 'Google API key (AIza...)', regex: /\bAIza[0-9A-Za-z\-_]{20,}\b/g },
  { label: 'GitHub token', regex: /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g },
  { label: 'Anthropic key (sk-ant-...)', regex: /\bsk-ant-[A-Za-z0-9\-_]{20,}\b/g },
  { label: 'JWT token', regex: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9._-]{10,}\.[A-Za-z0-9._-]{10,}\b/g },
];

const SENSITIVE_JSON_KEYS_REGEX =
  /"(gemini_api_key|openai_api_key|groq_api_key|openrouter_api_key|claude_api_key|deepseek_api_key|apiKeys|api_key)"\s*:\s*"[^"]{12,}"/gi;

const API_KEYS_IN_URL_REGEX = /apiKeys=%7B[^%]{30,}%7D|apiKeys=\{[^}]{30,}\}/gi;

const LOCALSTORAGE_DUMP_REGEX = /omnisuite_settings[^;]{0,200}(AIza|sk-|gsk_)/gi;

function looksLikePlaceholder(value) {
  const v = String(value).toLowerCase();
  return (
    v.includes('process.env') ||
    v.includes('import.meta.env') ||
    v.startsWith('${') ||
    v.includes('your_') ||
    v.includes('placeholder') ||
    v.includes('example') ||
    v.includes('changeme') ||
    v.includes('dummy') ||
    v.includes('test') ||
    v.includes('fake') ||
    v.includes('private') ||
    v.includes('abc123') ||
    v.includes('mock') ||
    v.includes('here') ||
    v === 'ollama' ||
    v.length < 12
  );
}

function scanTextForSecrets(fileLabel, content) {
  const findings = [];

  let m;
  while ((m = SECRET_ASSIGNMENT_REGEX.exec(content)) !== null) {
    const keyName = m[1];
    const keyValue = m[2];
    if (!looksLikePlaceholder(keyValue)) {
      findings.push(`${fileLabel}: hardcoded ${keyName}`);
    }
  }
  SECRET_ASSIGNMENT_REGEX.lastIndex = 0;

  for (const pattern of DIRECT_TOKEN_PATTERNS) {
    if (pattern.regex.test(content)) {
      findings.push(`${fileLabel}: ${pattern.label}`);
    }
    pattern.regex.lastIndex = 0;
  }

  if (SENSITIVE_JSON_KEYS_REGEX.test(content)) {
    findings.push(`${fileLabel}: API keys in JSON/localStorage dump`);
  }
  SENSITIVE_JSON_KEYS_REGEX.lastIndex = 0;

  if (API_KEYS_IN_URL_REGEX.test(content)) {
    findings.push(`${fileLabel}: API keys in URL query (apiKeys=...)`);
  }
  API_KEYS_IN_URL_REGEX.lastIndex = 0;

  if (LOCALSTORAGE_DUMP_REGEX.test(content)) {
    findings.push(`${fileLabel}: possible omnisuite_settings leak with API key`);
  }
  LOCALSTORAGE_DUMP_REGEX.lastIndex = 0;

  return findings;
}

module.exports = {
  SECRET_ASSIGNMENT_REGEX,
  DIRECT_TOKEN_PATTERNS,
  looksLikePlaceholder,
  scanTextForSecrets,
};
