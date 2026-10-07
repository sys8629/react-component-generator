import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

const CONFIG = { ok: true, json: async () => ({ envKeys: { anthropic: false, google: false } }) };

describe('App 영속성', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(CONFIG));
  });

  it('API 키와 Provider가 새로고침 후에도 유지된다', async () => {
    const user = userEvent.setup();
    const first = render(<App />);
    await user.selectOptions(screen.getByLabelText('Provider'), 'anthropic');
    await user.type(screen.getByLabelText('API Key'), 'sk-ant-test');
    first.unmount();

    render(<App />);
    expect(screen.getByLabelText('Provider')).toHaveValue('anthropic');
    expect(screen.getByLabelText('API Key')).toHaveValue('sk-ant-test');
  });

  it('Provider를 바꾸면 API 키 입력이 초기화된다(기존 동작 유지)', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByLabelText('API Key'), 'AIza-test');
    await user.selectOptions(screen.getByLabelText('Provider'), 'anthropic');
    expect(screen.getByLabelText('API Key')).toHaveValue('');
  });

  it('제출한 프롬프트가 히스토리에 남고 새로고침 후에도 보인다', async () => {
    localStorage.setItem('rcg:apiKey', JSON.stringify('k'));
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string) =>
        url === '/api/config'
          ? CONFIG
          : { ok: true, json: async () => ({ code: 'const A = () => null;\nrender(<A />);' }) },
      ),
    );
    const user = userEvent.setup();
    const first = render(<App />);
    await user.type(screen.getByRole('textbox', { name: '무엇을 만들까요?' }), '로그인 폼');
    await user.click(screen.getByRole('button', { name: '컴포넌트 생성' }));
    await screen.findByText('생성된 컴포넌트 1개');
    first.unmount();

    render(<App />);
    expect(screen.getByRole('button', { name: '로그인 폼' })).toBeInTheDocument();
  });
});
