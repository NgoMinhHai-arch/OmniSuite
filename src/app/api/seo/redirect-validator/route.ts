import { NextRequest, NextResponse } from "next/server";

interface RedirectCheckRequest {
  url: string;
}

interface RedirectCheckResponse {
  url: string;
  finalUrl: string;
  statusCodes: number[];
  redirectCount: number;
  error?: string;
}

async function followRedirects(
  url: string,
  maxRedirects: number = 10,
  statusCodes: number[] = []
): Promise<{ finalUrl: string; statusCodes: number[]; error?: string }> {
  try {
    if (statusCodes.length >= maxRedirects) {
      return { finalUrl: url, statusCodes, error: "Too many redirects" };
    }

    const response = await fetch(url, {
      method: "HEAD",
      redirect: "manual",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    const status = response.status;
    statusCodes.push(status);

    // Check for redirect status codes
    if (status >= 300 && status < 400) {
      const location = response.headers.get("location");
      if (location) {
        // Resolve relative URLs
        const finalUrl = location.startsWith("http")
          ? location
          : new URL(location, url).toString();
        return followRedirects(finalUrl, maxRedirects, statusCodes);
      }
    }

    return { finalUrl: url, statusCodes };
  } catch (error) {
    return {
      finalUrl: url,
      statusCodes,
      error: error instanceof Error ? error.message : "Request failed",
    };
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: RedirectCheckRequest = await request.json();
    const { url } = body;

    if (!url || !url.startsWith("http")) {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    const result = await followRedirects(url);

    const redirectCount = result.statusCodes.filter((s) => s >= 300 && s < 400).length;

    const response: RedirectCheckResponse = {
      url,
      finalUrl: result.finalUrl,
      statusCodes: result.statusCodes,
      redirectCount,
      error: result.error,
    };

    return NextResponse.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
