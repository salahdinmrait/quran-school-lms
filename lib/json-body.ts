import { NextResponse } from "next/server";

/**
 * Leest de JSON-body van een verzoek zonder te crashen.
 *
 * `req.json()` gooit bij een lege of kapotte body. Zonder vangnet komt die
 * fout als serverfout (500) bij de client terecht, terwijl het gewoon een
 * ongeldig verzoek is. Deze helper geeft in dat geval een nette 400 terug.
 */
// Bewust los getypeerd: de aanroepers destructureren zelf en valideren daarna,
// precies zoals ze dat met het rauwe `await req.json()` deden.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type JsonBody = Record<string, any>;

export async function leesJson<T extends object = JsonBody>(
  req: Request
): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  let data: unknown;
  try {
    data = await req.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "Ongeldige JSON in het verzoek" }, { status: 400 }),
    };
  }
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Verzoek moet een JSON-object zijn" }, { status: 400 }),
    };
  }
  return { ok: true, data: data as T };
}
