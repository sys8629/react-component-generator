import { useState, useEffect, useRef } from 'react';

interface CodeViewProps {
  code: string;
  /** 스트리밍 중이면 새 코드가 들어올 때마다 맨 아래로 스크롤한다. */
  streaming?: boolean;
}

export function CodeView({ code, streaming = false }: CodeViewProps) {
  const [copied, setCopied] = useState(false);
  const blockRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (streaming && blockRef.current) {
      blockRef.current.scrollTop = blockRef.current.scrollHeight;
    }
  }, [code, streaming]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="code-panel">
      <div className="panel-header">
        <span>{code.split('\n').length}줄</span>
        <button className="btn btn-copy" onClick={handleCopy}>
          {copied ? '복사됨!' : '복사'}
        </button>
      </div>
      <pre className="code-block" tabIndex={0} ref={blockRef}>
        <code>{code}</code>
      </pre>
    </div>
  );
}
