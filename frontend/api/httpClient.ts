// frontend/api/httpClient.ts
const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:3000';

const withBase = (path: string): string => `${API_BASE}${path}`;

export type RequestOptions = {
  timeoutMs?: number;
  signal?: AbortSignal;
};

const setupAbort = (options?: RequestOptions) => {
  if (!options?.timeoutMs && !options?.signal) {
    return { signal: undefined, cleanup: () => {} };
  }

  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;

  if (options?.signal) {
    if (options.signal.aborted) {
      controller.abort();
    } else {
      onAbort = () => controller.abort();
      options.signal.addEventListener('abort', onAbort, { once: true });
    }
  }

  if (options?.timeoutMs) {
    timeoutId = setTimeout(() => controller.abort(), options.timeoutMs);
  }

  const cleanup = () => {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
    if (options?.signal && onAbort) {
      options.signal.removeEventListener('abort', onAbort);
    }
  };

  return { signal: controller.signal, cleanup };
};

const runFetch = async (
  path: string,
  init: RequestInit,
  options?: RequestOptions
): Promise<Response> => {
  const { signal, cleanup } = setupAbort(options);
  try {
    return await fetch(withBase(path), { ...init, signal });
  } finally {
    cleanup();
  }
};

export async function getJson<T>(path: string, options?: RequestOptions): Promise<T> {
  const response = await runFetch(
    path,
    {
      headers: {
        'Content-Type': 'application/json'
      }
    },
    options
  );

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function postJson<T>(
  path: string,
  body: unknown,
  options?: RequestOptions
): Promise<T> {
  const response = await runFetch(
    path,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    },
    options
  );

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function patchJson<T>(
  path: string,
  body: unknown,
  options?: RequestOptions
): Promise<T> {
  const response = await runFetch(
    path,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    },
    options
  );

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}
