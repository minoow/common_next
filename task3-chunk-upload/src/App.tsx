import { useEffect, useMemo, useRef, useState } from 'react';

const chunkSize = 1024 * 1024;
const clientStorageKey = 'task3.client.session';

type ClientSession = {
  sessionId: string;
  fileKey: string;
  fileName: string;
  fileSize: number;
  totalChunks: number;
  completed: number[];
  status: 'idle' | 'uploading' | 'paused' | 'failed' | 'completed';
  error?: string;
};

export function App() {
  const [file, setFile] = useState<File | null>(null);
  const [session, setSession] = useState<ClientSession | null>(() => {
    const raw = localStorage.getItem(clientStorageKey);
    return raw ? (JSON.parse(raw) as ClientSession) : null;
  });
  const [log, setLog] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (session) localStorage.setItem(clientStorageKey, JSON.stringify(session));
  }, [session]);

  const progress = useMemo(() => {
    if (!session) return 0;
    return Math.round((session.completed.length / session.totalChunks) * 100);
  }, [session]);

  const chooseFile = (selected: File | null) => {
    setFile(selected);
    if (!selected) return;
    const totalChunks = Math.ceil(selected.size / chunkSize);
    const fileKey = createFileKey(selected);
    const existing = session?.fileKey === fileKey ? session : null;
    setSession(
      existing ?? {
        sessionId: '',
        fileKey,
        fileName: selected.name,
        fileSize: selected.size,
        totalChunks,
        completed: [],
        status: 'idle'
      }
    );
  };

  const upload = async () => {
    if (!file || !session) return;
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setSession((current) => current && { ...current, status: 'uploading', error: undefined });
      appendLog('업로드 세션을 확인합니다.');

      const serverSession = await createOrResumeSession(file, session);
      setSession((current) =>
        current && {
          ...current,
          sessionId: serverSession.id,
          completed: serverSession.completed,
          status: 'uploading'
        }
      );

      const completed = new Set(serverSession.completed);
      for (let index = 0; index < session.totalChunks; index += 1) {
        if (controller.signal.aborted) throw new DOMException('Upload paused', 'AbortError');
        if (completed.has(index)) continue;

        await uploadChunkWithRetry(serverSession.id, file, index, controller.signal);
        completed.add(index);
        const nextCompleted = [...completed].sort((a, b) => a - b);
        setSession((current) => current && { ...current, completed: nextCompleted });
        appendLog(`${index + 1}/${session.totalChunks} 청크 업로드 완료`);
      }

      await fetch(`/api/chunk-upload/session/${serverSession.id}/complete`, { method: 'POST' });
      setSession((current) => current && { ...current, completed: [...completed], status: 'completed' });
      appendLog('파일 업로드가 완료되었습니다.');
    } catch (error) {
      const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
      setSession((current) =>
        current && {
          ...current,
          status: error instanceof DOMException && error.name === 'AbortError' ? 'paused' : 'failed',
          error: message
        }
      );
      appendLog(message);
    } finally {
      abortRef.current = null;
    }
  };

  const pause = () => {
    abortRef.current?.abort();
  };

  const reset = () => {
    abortRef.current?.abort();
    localStorage.removeItem(clientStorageKey);
    setFile(null);
    setSession(null);
    setLog([]);
  };

  const canUpload = file && session && session.status !== 'uploading' && session.status !== 'completed';
  const needsSameFile = session && !file && session.status !== 'completed';

  return (
    <main className="shell">
      <section className="header">
        <div>
          <p className="eyebrow">Task 3</p>
          <h1>재개 가능한 청크 업로드</h1>
        </div>
        <button onClick={reset}>초기화</button>
      </section>

      <label className="picker">
        <input type="file" onChange={(event) => chooseFile(event.target.files?.[0] ?? null)} />
        <strong>{file?.name ?? session?.fileName ?? '대용량 파일 선택'}</strong>
        <span>
          {needsSameFile
            ? '저장된 세션이 있습니다. 같은 파일을 다시 선택하면 이어서 업로드할 수 있습니다.'
            : '파일은 1MB 청크 단위로 나뉘어 업로드됩니다.'}
        </span>
      </label>

      <section className="panel">
        <div className="progressHeader">
          <span>{session?.status ?? 'idle'}</span>
          <strong>{progress}%</strong>
        </div>
        <div className="bar"><span style={{ width: `${progress}%` }} /></div>
        <div className="meta">
          <span>파일 크기: {formatBytes(session?.fileSize ?? 0)}</span>
          <span>청크: {session?.completed.length ?? 0}/{session?.totalChunks ?? 0}</span>
          <span>세션: {session?.sessionId ? session.sessionId.slice(0, 8) : '-'}</span>
        </div>
        {session?.error && <p className="error">{session.error}</p>}
        <div className="actions">
          <button disabled={!canUpload} onClick={upload}>업로드 / 재개</button>
          <button disabled={session?.status !== 'uploading'} onClick={pause}>일시정지</button>
        </div>
      </section>

      <section className="chunks">
        {Array.from({ length: session?.totalChunks ?? 0 }).map((_, index) => (
          <span
            className={session?.completed.includes(index) ? 'done' : ''}
            key={index}
            title={`chunk ${index + 1}`}
          />
        ))}
      </section>

      <section className="log">
        <strong>이벤트 로그</strong>
        {log.length === 0 ? <span>아직 이벤트가 없습니다.</span> : log.map((item, index) => <span key={`${item}-${index}`}>{item}</span>)}
      </section>
    </main>
  );

  function appendLog(message: string) {
    setLog((current) => [message, ...current].slice(0, 8));
  }
}

async function createOrResumeSession(file: File, session: ClientSession) {
  const response = await fetch('/api/chunk-upload/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileKey: session.fileKey,
      fileName: file.name,
      fileSize: file.size,
      chunkSize,
      totalChunks: session.totalChunks
    })
  });
  return response.json() as Promise<{ id: string; completed: number[] }>;
}

async function uploadChunkWithRetry(sessionId: string, file: File, index: number, signal: AbortSignal) {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const start = index * chunkSize;
      const chunk = file.slice(start, Math.min(file.size, start + chunkSize));
      const response = await fetch(`/api/chunk-upload/session/${sessionId}/chunk?index=${index}`, {
        method: 'PUT',
        body: chunk,
        signal
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message ?? '청크 업로드 실패');
      }
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
      lastError = error instanceof Error ? error : new Error('청크 업로드 실패');
      await new Promise((resolve) => window.setTimeout(resolve, 250 * attempt));
    }
  }

  throw lastError ?? new Error('청크 업로드 실패');
}

function createFileKey(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function formatBytes(bytes: number) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(1)} ${units[index]}`;
}

