import { useState } from 'react';
import type { GeneratedComponent } from '../types';
import { LivePreview } from './LivePreview';
import { CodeView } from './CodeView';

interface ComponentCardProps {
  component: GeneratedComponent;
  onRemove: (id: string) => void;
  onRegenerate: (prompt: string) => void;
  isLoading: boolean;
  /** 코드가 스트리밍으로 생성되는 중이면 코드 탭을 보여주고, 끝나면 미리보기로 전환한다. */
  streaming?: boolean;
}

type Tab = 'preview' | 'code';

export function ComponentCard({ component, onRemove, onRegenerate, isLoading, streaming = false }: ComponentCardProps) {
  const [activeTab, setActiveTab] = useState<Tab>(streaming ? 'code' : 'preview');
  const [prevStreaming, setPrevStreaming] = useState(streaming);
  if (streaming !== prevStreaming) {
    setPrevStreaming(streaming);
    setActiveTab(streaming ? 'code' : 'preview');
  }
  const [previewKey, setPreviewKey] = useState(0);
  const createdAt = component.createdAt.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <article className="win component-card">
      <div className="win-title">
        <h2>{createdAt} 생성</h2>
      </div>
      <div className="win-body">
        <div className="card-header">
          <p className="card-prompt">{component.prompt}</p>
          <div className="card-actions">
            <button
              className="btn btn-refresh"
              onClick={() => setPreviewKey((k) => k + 1)}
              title="미리보기 새로고침"
              aria-label="미리보기 새로고침"
            >
              ↻
            </button>
            <button
              className="btn btn-regenerate"
              onClick={() => onRegenerate(component.prompt)}
              disabled={isLoading}
            >
              {isLoading ? '생성 중...' : '재생성'}
            </button>
            <button
              className="btn btn-remove"
              onClick={() => onRemove(component.id)}
              disabled={streaming}
            >
              삭제
            </button>
          </div>
        </div>
        <div className="card-tabs" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === 'preview'}
            className={`tab ${activeTab === 'preview' ? 'tab--active' : ''}`}
            onClick={() => setActiveTab('preview')}
            disabled={streaming}
          >
            미리보기
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'code'}
            className={`tab ${activeTab === 'code' ? 'tab--active' : ''}`}
            onClick={() => setActiveTab('code')}
          >
            코드
          </button>
        </div>
        <div className="card-content" role="tabpanel">
          {activeTab === 'preview' ? (
            <LivePreview key={previewKey} code={component.code} />
          ) : (
            <CodeView code={component.code} streaming={streaming} />
          )}
        </div>
      </div>
    </article>
  );
}
