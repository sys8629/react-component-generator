import { useState, useCallback, useRef } from 'react';
import type { GeneratedComponent, Provider } from '../types';
import { useLocalStorage } from './useLocalStorage';
import { readNdjson } from '../utils/ndjson';

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
  /** 코드가 생성되는 중인 컴포넌트(누적된 코드 포함). 생성 중이 아니면 null. */
  streaming: GeneratedComponent | null;
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
  const inFlight = useRef(false);
  const [streaming, setStreaming] = useState<GeneratedComponent | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (prompt: string, apiKey: string | undefined, provider: Provider) => {
    // 상태 갱신 전에 연속 호출(더블클릭 등)이 들어와도 요청이 겹치지 않게 ref로 막는다.
    if (inFlight.current) return;
    inFlight.current = true;
    setIsLoading(true);
    setError(null);

    // 스트리밍 카드와 완성된 카드가 같은 id를 써서 화면에서 같은 카드로 이어진다.
    const draft: GeneratedComponent = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      prompt,
      code: '',
      createdAt: new Date(),
    };
    setStreaming(draft);

    try {
      const res = await fetch('/api/generate/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, ...(apiKey && { apiKey }), provider }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to generate component');
      }

      let received = '';
      let finalCode: string | null = null;

      for await (const event of readNdjson(res.body)) {
        const e = event as { type: string; text?: string; code?: string; error?: string };
        if (e.type === 'delta') {
          received += e.text ?? '';
          setStreaming({ ...draft, code: received });
        } else if (e.type === 'done') {
          finalCode = e.code ?? received;
        } else if (e.type === 'error') {
          throw new Error(e.error || 'Failed to generate component');
        }
      }

      if (finalCode === null) {
        throw new Error('응답이 중간에 끊겼습니다. 다시 시도해주세요.');
      }

      const finished: GeneratedComponent = { ...draft, code: finalCode };
      setComponents((prev) => [finished, ...prev]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    } finally {
      setStreaming(null);
      setIsLoading(false);
      inFlight.current = false;
    }
  }, [setComponents]);

  const removeComponent = useCallback((id: string) => {
    setComponents((prev) => prev.filter((c) => c.id !== id));
  }, [setComponents]);

  const clearAll = useCallback(() => {
    setComponents([]);
  }, [setComponents]);

  return { components, streaming, isLoading, error, generate, removeComponent, clearAll };
}
