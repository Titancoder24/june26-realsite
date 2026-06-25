/** Parse fetch response body as JSON; surface plain-text/HTML errors clearly. */
export async function readJsonResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text.trim()) {
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    return {} as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    const snippet = text.trim().replace(/\s+/g, " ").slice(0, 160);
    throw new Error(
      res.ok
        ? `Invalid JSON response (${res.status})`
        : snippet || `Request failed (${res.status})`,
    );
  }
}
