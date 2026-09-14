"use client";
export async function requestJson<T = Record<string, unknown>>(url: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try { response = await fetch(url, options); }
  catch { throw new Error("Não foi possível conectar. Verifique sua conexão e tente novamente."); }
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) throw new Error(data?.error ?? data?.message ?? "Não foi possível concluir. Tente novamente.");
  return data as T;
}
export function jsonOptions(method: string, data: unknown): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) };
}
