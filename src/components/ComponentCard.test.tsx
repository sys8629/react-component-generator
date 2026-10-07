import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ComponentCard } from './ComponentCard';
import type { GeneratedComponent } from '../types';

vi.mock('./LivePreview', () => ({
  LivePreview: ({ code }: { code: string }) => <div data-testid="live-preview">{code}</div>,
}));

const base: GeneratedComponent = {
  id: '1',
  prompt: '카드',
  code: 'const A = () => null;',
  createdAt: new Date(),
};

function renderCard(component: GeneratedComponent, streaming: boolean) {
  const props = { onRemove: vi.fn(), onRegenerate: vi.fn(), isLoading: streaming };
  const view = render(<ComponentCard component={component} streaming={streaming} {...props} />);
  const rerender = (next: GeneratedComponent, nextStreaming: boolean) =>
    view.rerender(<ComponentCard component={next} streaming={nextStreaming} {...props} isLoading={nextStreaming} />);
  return { rerender };
}

describe('ComponentCard 스트리밍', () => {
  it('스트리밍 중에는 코드 탭이 선택되고 받은 코드가 보인다', () => {
    renderCard({ ...base, code: 'const Part' }, true);
    expect(screen.getByRole('tab', { name: '코드' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('const Part')).toBeInTheDocument();
    expect(screen.queryByTestId('live-preview')).not.toBeInTheDocument();
  });

  it('스트리밍 중에는 미리보기 탭을 누를 수 없다', () => {
    renderCard(base, true);
    expect(screen.getByRole('tab', { name: '미리보기' })).toBeDisabled();
  });

  it('스트리밍이 끝나면 미리보기 탭으로 전환된다', () => {
    const { rerender } = renderCard({ ...base, code: 'const Part' }, true);
    rerender(base, false);
    expect(screen.getByRole('tab', { name: '미리보기' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('live-preview')).toBeInTheDocument();
  });

  it('스트리밍이 아니면 기본으로 미리보기 탭이다', () => {
    renderCard(base, false);
    expect(screen.getByRole('tab', { name: '미리보기' })).toHaveAttribute('aria-selected', 'true');
  });
});
