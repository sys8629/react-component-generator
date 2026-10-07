import { useState, useCallback } from 'react';
import type { GeneratedComponent, Provider } from '../types';
import { useLocalStorage } from './useLocalStorage';

export const COMPONENTS_STORAGE_KEY = 'rcg:components';

// 저장된 JSON을 검증하고 createdAt을 Date로 복원한다. 형식이 틀리면 던져서 fallback을 쓰게 한다.
function reviveComponents(raw: unknown): GeneratedComponent[] {
  if (!Array.isArray(raw)) throw new Error('invalid components');
  return raw.map((item) => {
    const { id, prompt, code, createdAt } = item ?? {};
    if (typeof id !== 'string' || typeof prompt !== 'string' || typeof code !== 'string') {
      throw new Error('invalid component');
    }
    const date = new Date(createdAt);
    if (Number.isNaN(date.getTime())) throw new Error('invalid createdAt');
    return { id, prompt, code, createdAt: date };
  });
}

interface UseComponentGeneratorReturn {
  components: GeneratedComponent[];
  isLoading: boolean;
  error: string | null;
  generate: (prompt: string, apiKey: string | undefined, provider: Provider) => Promise<void>;
  removeComponent: (id: string) => void;
  clearAll: () => void;
}

export function useComponentGenerator(): UseComponentGeneratorReturn {
  const [components, setComponents] = useLocalStorage<GeneratedComponent[]>(
    COMPONENTS_STORAGE_KEY,
    [],
    reviveComponents,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (prompt: string, apiKey: string | undefined, provider: Provider) => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, ...(apiKey && { apiKey }), provider }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate component');
      }

      const newComponent: GeneratedComponent = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        prompt,
        code: data.code,
        createdAt: new Date(),
      };

      setComponents((prev) => [newComponent, ...prev]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [setComponents]);

  const removeComponent = useCallback((id: string) => {
    setComponents((prev) => prev.filter((c) => c.id !== id));
  }, [setComponents]);

  const clearAll = useCallback(() => {
    setComponents([]);
  }, [setComponents]);

  return { components, isLoading, error, generate, removeComponent, clearAll };
}
