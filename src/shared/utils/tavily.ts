/**
 * TAVILY SEARCH HELPER
 * Version 1.1 - Optimized for RAG with content cleaning
 */

// In-Memory Cache (Simple Map)
const tavilyCache = new Map<string, string>();

/**
 * Strip junk from raw HTML/Markdown content
 * Removes images, navigation, footers, sidebars, empty lines, etc.
 */
function cleanContent(raw: string): string {
  return raw
    // Remove markdown images ![...](...) 
    .replace(/!\[.*?\]\(.*?\)/g, '')
    // Remove HTML img tags
    .replace(/<img[^>]*>/gi, '')
    // Remove HTML script/style blocks
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    // Remove HTML tags entirely
    .replace(/<[^>]+>/g, '')
    // Remove markdown links but keep text: [text](url) → text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    // Remove lines that are just URLs
    .replace(/^https?:\/\/\S+$/gm, '')
    // Remove lines with mostly special characters (nav/menu junk)
    .replace(/^[\s|*\-#>]+$/gm, '')
    // Remove repeated separator lines
    .replace(/^-{3,}$/gm, '')
    // Remove empty markdown table rows  
    .replace(/^\|[\s|:-]*\|$/gm, '')
    // Collapse multiple blank lines into one
    .replace(/\n{3,}/g, '\n\n')
    // Trim whitespace
    .trim();
}

/**
 * Fetch context from Tavily Search API
 * @param query The search query (keyword)
 * @param apiKey Tavily API Key
 * @returns Cleaned string of context
 */
export async function fetchTavilyContext(query: string, apiKey: string): Promise<string> {
  if (!apiKey) return "";
  
  // 1. Check Cache
  const normalizedQuery = query.trim().toLowerCase();
  if (tavilyCache.has(normalizedQuery)) {
    console.log(`[Tavily] Cache HIT for: ${normalizedQuery}`);
    return tavilyCache.get(normalizedQuery) || "";
  }

  console.log(`[Tavily] Cache MISS, fetching: ${normalizedQuery}`);

  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: apiKey,
        query: normalizedQuery,
        search_depth: "advanced",
        include_raw_content: true,
        max_results: 5,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("[Tavily] API Error:", errorData);
      return "";
    }

    const data = await response.json();
    
    // 2. Extract, Clean and Build Context
    let contextParts: string[] = [];
    
    if (data.results && Array.isArray(data.results)) {
      data.results.forEach((result: any) => {
        const rawText = result.raw_content || result.content || "";
        const url = result.url || "";
        const title = result.title || "";
        
        // Clean the content
        const cleaned = cleanContent(rawText);
        
        // Only include if there's meaningful content left (>100 chars)
        if (cleaned.length > 100) {
          contextParts.push(`[${title}] (${url})\n${cleaned}`);
        }
      });
    }

    // 3. Join and Trim to ~1500 tokens (approx 6,000 characters)
    // Giảm mạnh để tránh lỗi túi tiền (OpenRouter Block)
    let fullContext = contextParts.join("\n\n---\n\n");
    if (fullContext.length > 6000) {
      fullContext = fullContext.substring(0, 6000) + "\n... [Đã cắt bớt để tiết kiệm]";
    }

    // 4. Save to Cache
    tavilyCache.set(normalizedQuery, fullContext);

    return fullContext;
  } catch (error) {
    console.error("[Tavily] Fetch error:", error);
    return "";
  }
}
