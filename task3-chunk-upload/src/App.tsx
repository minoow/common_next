import { useEffect, useMemo, useRef, useState } from 'react';

const chunkSize = 5 * 1024 * 1024;
const maxConcurrency = 3;
const retryDelays = [1000, 2000, 4000];
const clientStorageKey = 'task3.client.session';

type UploadStatus = 'idle' | 'ready' | 'uploading' | 'paused' | 'failed' | 'completed';

type ClientSession = {
  uploadId: string;
  fileKey: string;
  fileName: string;
  fileSize: number;
  chunkSize: number;
  totalChunks: number;
  completed: number[];
  inFlight: number[];
  failed: number[];
  retryCounts: Record<number, number>;
  status: UploadStatus;
  error?: string;
};

type ServerUpload = {
  uploadId: string;
  fileKey: string;
  fileName: string;
  fileSize: number;
  chunkSize: number;
  totalChunks: number;
  uploadedChunks: Record<string, { uploaded: true; timestamp: number; size: number }>;
  status: 'initialized' | 'uploading' | 'completed';
};

export function App() {
  const [file, setFile] = useState<File | null>(null);
  const [session, setSession] = useState<ClientSession | null>(() => readClientSession());
  const [log, setLog] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const pausedRef = useRef(false);

  useEffect(() => {
    if (session) localStorage.setItem(clientStorageKey, JSON.stringify(session));
  }, [session]);

  const progress = useMemo(() => {
    if (!session) return 0;
    return Math.round((session.completed.length / session.totalChunks) * 100);
  }, [session]);

  const chooseFile = async (selected: File | null) => {
    setFile(selected);
    if (!selected) return;

    const totalChunks = Math.ceil(selected.size / chunkSize);
    const fileKey = createFileKey(selected);
    const existing = session?.fileKey === fileKey ? session : null;
    const next: ClientSession = existing ?? {
      uploadId: '',
      fileKey,
      fileName: selected.name,
      fileSize: selected.size,
      chunkSize,
      totalChunks,
      completed: [],
      inFlight: [],
      failed: [],
      retryCounts: {},
      status: 'ready'
    };

    setSession(next);
    appendLog('파일이 선택되었습니다. 업로드 상태를 복원할 수 있습니다.');
  };

  const upload = async () => {
    if (!file || !session) return;

    const controller = new AbortController();
    abortRef.current = controller;
    pausedRef.current = false;

    try {
      setSession((current) => current && { ...current, status: 'uploading', error: undefined, failed: [] });
      appendLog('업로드를 초기화하고 서버 상태를 조회합니다.');

      const initialized = await initUpload(file, session);
      const status = await getUploadStatus(initialized.uploadId);
      const completed = uploadedChunkIndexes(status);

      setSession((current) => current && {
        ...current,
        uploadId: initialized.uploadId,
        completed,
        status: 'uploading',
        error: undefined
      });

      await uploadChunksWithPool(file, initialized.uploadId, session.totalChunks, completed, controller);

      const completeResponse = await fetch('/api/upload/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadId: initialized.uploadId })
      });
      if (!completeResponse.ok) {
        const data = await completeResponse.json();
        throw new Error(data.message ?? '업로드 완료 처리에 실패했습니다.');
      }
      const completedIndexes = Array.from({ length: session.totalChunks }, (_, index) => index);
      setSession((current) => current && { ...current, completed: completedIndexes, inFlight: [], failed: [], status: 'completed' });
      appendLog('모든 청크 업로드가 완료되었습니다.');
    } catch (error) {
      const isAbort = error instanceof DOMException && error.name === 'AbortError';
      const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
      setSession((current) => current && {
        ...current,
        inFlight: [],
        status: isAbort || pausedRef.current ? 'paused' : 'failed',
        error: isAbort || pausedRef.current ? undefined : message
      });
      appendLog(isAbort || pausedRef.current ? '업로드가 일시정지되었습니다.' : message);
    } finally {
      abortRef.current = null;
    }
  };

  const restoreStatus = async () => {
    if (!session?.uploadId) return;
    const status = await getUploadStatus(session.uploadId);
    setSession((current) => current && {
      ...current,
      completed: uploadedChunkIndexes(status),
      status: status.status === 'completed' ? 'completed' : current.status
    });
    appendLog('Mock API에서 업로드 상태를 복원했습니다.');
  };

  const pause = () => {
    pausedRef.current = true;
    abortRef.current?.abort();
  };

  const reset = () => {
    pausedRef.current = true;
    abortRef.current?.abort();
    localStorage.removeItem(clientStorageKey);
    setFile(null);
    setSession(null);
    setLog([]);
  };

  const createTestFile = (sizeMb: number) => {
    const mock = new File([new ArrayBuffer(sizeMb * 1024 * 1024)], `mock-${sizeMb}mb.bin`, {
      type: 'application/octet-stream'
    });
    void chooseFile(mock);
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
        <input type="file" onChange={(event) => void chooseFile(event.target.files?.[0] ?? null)} />
        <strong>{file?.name ?? session?.fileName ?? '대용량 파일 선택'}</strong>
        <span>
          {needsSameFile
            ? '저장된 세션이 있습니다. 같은 파일을 다시 선택하면 이어서 업로드할 수 있습니다.'
            : '파일은 5MB 청크 단위로 나뉘며 최대 3개 청크가 병렬 업로드됩니다.'}
        </span>
      </label>

      <section className="quickCreate">
        <span>Mock 테스트 파일</span>
        <button onClick={() => createTestFile(50)}>50MB</button>
        <button onClick={() => createTestFile(100)}>100MB</button>
        <button onClick={() => createTestFile(200)}>200MB</button>
      </section>

      <section className="panel">
        <div className="progressHeader">
          <span>{session?.status ?? 'idle'}</span>
          <strong>{progress}%</strong>
        </div>
        <div className="bar"><span style={{ width: `${progress}%` }} /></div>
        <div className="meta">
          <span>파일 크기: {formatBytes(session?.fileSize ?? 0)}</span>
          <span>청크 크기: 5MB</span>
          <span>동시 업로드: 최대 {maxConcurrency}개</span>
          <span>청크: {session?.completed.length ?? 0}/{session?.totalChunks ?? 0}</span>
          <span>진행 중: {session?.inFlight.length ?? 0}</span>
          <span>실패: {session?.failed.length ?? 0}</span>
          <span>세션: {session?.uploadId ? session.uploadId.slice(0, 8) : '-'}</span>
        </div>
        {session?.error && <p className="error">{session.error}</p>}
        <div className="actions">
          <button disabled={!canUpload} onClick={() => void upload()}>업로드 / 재개</button>
          <button disabled={session?.status !== 'uploading'} onClick={pause}>일시정지</button>
          <button disabled={!session?.uploadId} onClick={() => void restoreStatus()}>상태 복원</button>
        </div>
      </section>

      <section className="chunks">
        {Array.from({ length: session?.totalChunks ?? 0 }).map((_, index) => {
          const isDone = session?.completed.includes(index);
          const isActive = session?.inFlight.includes(index);
          const isFailed = session?.failed.includes(index);
          return (
            <span
              className={`${isDone ? 'done' : ''} ${isActive ? 'active' : ''} ${isFailed ? 'failed' : ''}`}
              key={index}
              title={`chunk ${index + 1}`}
            />
          );
        })}
      </section>

      <section className="log">
        <strong>이벤트 로그</strong>
        {log.length === 0 ? <span>아직 이벤트가 없습니다.</span> : log.map((item, index) => <span key={`${item}-${index}`}>{item}</span>)}
      </section>
    </main>
  );

  async function uploadChunksWithPool(fileToUpload: File, uploadId: string, totalChunks: number, completed: number[], controller: AbortController) {
    const completedSet = new Set(completed);
    const queue = Array.from({ length: totalChunks }, (_, index) => index).filter((index) => !completedSet.has(index));
    const failedSet = new Set<number>();
    let cursor = 0;

    const worker = async () => {
      while (cursor < queue.length) {
        if (controller.signal.aborted) throw new DOMException('Upload paused', 'AbortError');
        const chunkIndex = queue[cursor];
        cursor += 1;

        setSession((current) => current && {
          ...current,
          inFlight: unique([...current.inFlight, chunkIndex]),
          failed: current.failed.filter((index) => index !== chunkIndex)
        });

        try {
          await uploadChunkWithRetry(uploadId, fileToUpload, chunkIndex, controller.signal, (message) => appendLog(message));
          completedSet.add(chunkIndex);
          setSession((current) => current && {
            ...current,
            completed: [...completedSet].sort((a, b) => a - b),
            inFlight: current.inFlight.filter((index) => index !== chunkIndex)
          });
          appendLog(`${chunkIndex + 1}/${totalChunks} 청크 완료`);
        } catch (error) {
          setSession((current) => current && {
            ...current,
            inFlight: current.inFlight.filter((index) => index !== chunkIndex),
            failed: unique([...current.failed, chunkIndex])
          });
          if (error instanceof DOMException && error.name === 'AbortError') throw error;
          failedSet.add(chunkIndex);
          appendLog(`${chunkIndex + 1}번 청크 실패. 다른 청크는 계속 진행합니다.`);
        }
      }
    };

    await Promise.all(Array.from({ length: Math.min(maxConcurrency, queue.length) }, () => worker()));

    if (failedSet.size > 0) {
      throw new Error(`${failedSet.size}개 청크가 3회 재시도 후 실패했습니다.`);
    }
  }

  function appendLog(message: string) {
    setLog((current) => [message, ...current].slice(0, 10));
  }
}

async function initUpload(file: File, session: ClientSession) {
  const response = await fetch('/api/upload/init', {
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
  return response.json() as Promise<ServerUpload>;
}

async function getUploadStatus(uploadId: string) {
  const response = await fetch(`/api/upload/status/${uploadId}`);
  if (!response.ok) throw new Error('업로드 상태를 조회하지 못했습니다.');
  return response.json() as Promise<ServerUpload>;
}

async function uploadChunkWithRetry(
  uploadId: string,
  file: File,
  index: number,
  signal: AbortSignal,
  onRetry: (message: string) => void
) {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
    try {
      const start = index * chunkSize;
      const chunk = file.slice(start, Math.min(file.size, start + chunkSize));
      const formData = new FormData();
      formData.append('uploadId', uploadId);
      formData.append('chunkIndex', String(index));
      formData.append('chunkSize', String(chunk.size));
      formData.append('chunk', chunk);

      const response = await fetch('/api/upload/chunk', { method: 'POST', body: formData, signal });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message ?? '청크 업로드 실패');
      }
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
      lastError = error instanceof Error ? error : new Error('청크 업로드 실패');

      if (attempt < retryDelays.length) {
        const delayMs = retryDelays[attempt];
        onRetry(`${index + 1}번 청크 ${delayMs / 1000}초 후 재시도 (${attempt + 1}/3)`);
        await sleep(delayMs);
      }
    }
  }

  throw lastError ?? new Error('청크 업로드 실패');
}

function readClientSession() {
  const raw = localStorage.getItem(clientStorageKey);
  return raw ? (JSON.parse(raw) as ClientSession) : null;
}

function uploadedChunkIndexes(upload: ServerUpload) {
  return Object.keys(upload.uploadedChunks).map(Number).sort((a, b) => a - b);
}

function createFileKey(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function unique(values: number[]) {
  return [...new Set(values)].sort((a, b) => a - b);
}

function formatBytes(bytes: number) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(1)} ${units[index]}`;
}
