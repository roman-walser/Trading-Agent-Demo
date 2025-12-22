// frontend/api/httpClient.ts
const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:3000';

const withBase = (path: string): string => `${API_BASE}${path}`;

export async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(withBase(path), {
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}
