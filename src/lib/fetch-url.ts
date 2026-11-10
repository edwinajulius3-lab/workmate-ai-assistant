/**
 * Browsers can't read most websites directly (cross-origin rules), so pages are fetched
 * through the public Jina Reader service, which returns the readable text of a URL.
 */
export async function fetchPageText(url: string, signal?: AbortSignal): Promise<string> {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    throw new Error("That doesn't look like a valid web address. Include https://");
  }
  if (!/^https?:$/.test(parsed.protocol)) throw new Error("Only http and https links are supported.");

  let res: Response;
  try {
    res = await fetch(`https://r.jina.ai/${parsed.toString()}`, {
      signal: signal ?? null,
      headers: { Accept: "text/plain" },
    });
  } catch (e) {
    if ((e as Error)?.name === "AbortError") throw e;
    throw new Error("Couldn't read that page. Paste the article text instead.");
  }
  if (!res.ok) throw new Error(`Couldn't read that page (${res.status}). Paste the article text instead.`);
  const text = (await res.text()).trim();
  if (text.length < 200) throw new Error("The page had too little readable text. Paste the article text instead.");
  return text;
}
