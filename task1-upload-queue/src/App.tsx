import { DragEvent, useEffect, useMemo, useReducer, useRef } from 'react';

type UploadStatus = 'pending' | 'uploading' | 'paused' | 'completed' | 'failed' | 'cancelled';

type UploadItem = {
  id: string;
  serverId?: string;
  file: File;
  relativePath: string;
  status: UploadStatus;
  progress: number;
  speedMbps: number;
  etaSeconds: number | null;
  retryCount: number;
  error?: string;
};

type UploadState = {
  items: UploadItem[];
};

type Action =
  | { type: 'add-files'; files: File[] }
  | { type: 'patch-item'; id: string; patch: Partial<UploadItem> }
  | { type: 'cancel-all' }
  | { type: 'clear-finished' };

const statusLabel: Record<UploadStatus, string> = {
  pending: '대기',
  uploading: '업로드 중',
  paused: '일시정지',
  completed: '완료',
  failed: '실패',
  cancelled: '취소됨'
};

const terminalStatuses = new Set<UploadStatus>(['completed', 'failed', 'cancelled']);
const retryDelays = [1000, 2000, 4000];

export function App() {
  const [state, dispatch] = useReducer(reducer, { items: [] });
  const stateRef = useRef(state);
  const activeController = useRef<AbortController | null>(null);
  const activeId = useRef<string | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const hasUploading = state.items.some((item) => item.status === 'uploading');
  const nextPending = state.items.find((item) => item.status === 'pending');

  useEffect(() => {
    if (hasUploading || !nextPending) {
      return;
    }

    void uploadItem(nextPending);
  }, [hasUploading, nextPending?.id]);

  const summary = useMemo(() => {
    return state.items.reduce(
      (acc, item) => ({ ...acc, [item.status]: acc[item.status] + 1 }),
      { pending: 0, uploading: 0, paused: 0, completed: 0, failed: 0, cancelled: 0 } as Record<UploadStatus, number>
    );
  }, [state.items]);

  const addFiles = (files: FileList | File[] | null) => {
    if (!files) return;
    dispatch({ type: 'add-files', files: Array.from(files) });
  };

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    addFiles(event.dataTransfer.files);
  };

  const cancel = async (id: string) => {
    const item = findItem(id);
    if (!item || terminalStatuses.has(item.status)) return;

    if (activeId.current === id) {
      activeController.current?.abort();
    }
    if (item.serverId) {
      await fetch(`/api/upload/${item.serverId}`, { method: 'DELETE' });
    }
    dispatch({ type: 'patch-item', id, patch: { status: 'cancelled', progress: 0, speedMbps: 0, etaSeconds: null } });
  };

  const cancelAll = () => {
    activeController.current?.abort();
    for (const item of stateRef.current.items) {
      if (!terminalStatuses.has(item.status)) {
        if (item.serverId) void fetch(`/api/upload/${item.serverId}`, { method: 'DELETE' });
        dispatch({ type: 'patch-item', id: item.id, patch: { status: 'cancelled', speedMbps: 0, etaSeconds: null } });
      }
    }
  };

  const pause = async (id: string) => {
    const item = findItem(id);
    if (!item || item.status !== 'uploading') return;

    activeController.current?.abort();
    if (item.serverId) {
      await fetch(`/api/upload/${item.serverId}/pause`, { method: 'POST' });
    }
    dispatch({ type: 'patch-item', id, patch: { status: 'paused', speedMbps: 0, etaSeconds: null } });
  };

  const resume = async (id: string) => {
    const item = findItem(id);
    if (!item || item.status !== 'paused') return;

    if (item.serverId) {
      await fetch(`/api/upload/${item.serverId}/resume`, { method: 'POST' });
    }
    dispatch({ type: 'patch-item', id, patch: { status: 'pending', error: undefined } });
  };

  const retry = (id: string) => {
    const item = findItem(id);
    if (!item || item.status !== 'failed') return;
    dispatch({
      type: 'patch-item',
      id,
      patch: { status: 'pending', progress: 0, speedMbps: 0, etaSeconds: null, retryCount: 0, error: undefined }
    });
  };

  async function uploadItem(item: UploadItem) {
    const controller = new AbortController();
    activeController.current = controller;
    activeId.current = item.id;

    let progressTimer: number | undefined;
    const serverId = item.serverId ?? item.id;

    try {
      dispatch({
        type: 'patch-item',
        id: item.id,
        patch: { serverId, status: 'uploading', error: undefined, speedMbps: 0, etaSeconds: null }
      });

      const attempt = item.retryCount + 1;
      const startedAt = performance.now();
      const estimatedDurationMs = Math.max(700, sizeInMb(item.file.size) * randomBetween(100, 200));
      let lastProgress = item.progress;
      let lastTickAt = startedAt;

      progressTimer = window.setInterval(() => {
        const current = findItem(item.id);
        if (!current || current.status !== 'uploading') return;

        const now = performance.now();
        const elapsed = now - startedAt;
        const targetProgress = Math.min(95, Math.max(current.progress, (elapsed / estimatedDurationMs) * 95));
        const deltaProgress = Math.max(0, targetProgress - lastProgress);
        const deltaSeconds = Math.max(0.1, (now - lastTickAt) / 1000);
        const uploadedDeltaMb = sizeInMb(item.file.size) * (deltaProgress / 100);
        const speedMbps = uploadedDeltaMb / deltaSeconds;
        const remainingMb = sizeInMb(item.file.size) * ((100 - targetProgress) / 100);

        lastProgress = targetProgress;
        lastTickAt = now;

        dispatch({
          type: 'patch-item',
          id: item.id,
          patch: {
            progress: targetProgress,
            speedMbps,
            etaSeconds: speedMbps > 0 ? remainingMb / speedMbps : null
          }
        });
      }, 180);

      const formData = new FormData();
      formData.append('file', item.file);
      formData.append('uploadId', serverId);

      const response = await fetch('/api/upload', { method: 'POST', body: formData, signal: controller.signal });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message ?? '네트워크 오류가 발생했습니다.');
      }

      const data = (await response.json()) as { id: string; status: UploadStatus };
      if (data.status !== 'completed') {
        dispatch({
          type: 'patch-item',
          id: item.id,
          patch: { serverId, status: data.status, speedMbps: 0, etaSeconds: null }
        });
        return;
      }

      dispatch({
        type: 'patch-item',
        id: item.id,
        patch: { serverId, status: 'completed', progress: 100, speedMbps: 0, etaSeconds: 0, error: undefined }
      });
    } catch (error) {
      const current = findItem(item.id);
      const isAbort = error instanceof DOMException && error.name === 'AbortError';
      if (!current || current.status === 'paused' || current.status === 'cancelled' || isAbort) {
        return;
      }

      if (current.retryCount < retryDelays.length) {
        const delayMs = retryDelays[current.retryCount];
        dispatch({
          type: 'patch-item',
          id: item.id,
          patch: {
            status: 'uploading',
            retryCount: current.retryCount + 1,
            speedMbps: 0,
            etaSeconds: null,
            error: `${delayMs / 1000}초 후 자동 재시도합니다. (${current.retryCount + 1}/3)`
          }
        });
        await sleep(delayMs);
        if (findItem(item.id)?.status === 'uploading') {
          dispatch({ type: 'patch-item', id: item.id, patch: { status: 'pending' } });
        }
        return;
      }

      dispatch({
        type: 'patch-item',
        id: item.id,
        patch: {
          status: 'failed',
          speedMbps: 0,
          etaSeconds: null,
          error: error instanceof Error ? error.message : '업로드에 실패했습니다.'
        }
      });
    } finally {
      if (progressTimer) window.clearInterval(progressTimer);
      activeController.current = null;
      activeId.current = null;
    }
  }

  function findItem(id: string) {
    return stateRef.current.items.find((item) => item.id === id);
  }

  return (
    <main className="shell">
      <section className="header">
        <div>
          <p className="eyebrow">Task 1</p>
          <h1>멀티 파일 업로드 큐</h1>
        </div>
        <div className="headerActions">
          <button onClick={cancelAll}>전체 취소</button>
          <button onClick={() => dispatch({ type: 'clear-finished' })}>완료 항목 정리</button>
        </div>
      </section>

      <label className="dropzone" onDragOver={(event) => event.preventDefault()} onDrop={onDrop}>
        <input data-testid="file-input" multiple type="file" onChange={(event) => addFiles(event.target.files)} />
        <strong>파일 선택 또는 드래그앤드롭</strong>
        <span>여러 파일과 폴더 내 파일을 대기열에 추가하고 한 번에 하나씩 업로드합니다.</span>
      </label>

      <label className="folderButton">
        <input
          data-testid="folder-input"
          multiple
          type="file"
          onChange={(event) => addFiles(event.target.files)}
          {...{ webkitdirectory: '', directory: '' }}
        />
        폴더 업로드
      </label>

      <section className="stats">
        {Object.entries(summary).map(([key, value]) => (
          <div key={key}>
            <span>{statusLabel[key as UploadStatus]}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </section>

      <section className="queue">
        {state.items.length === 0 ? (
          <p className="empty">아직 큐에 파일이 없습니다.</p>
        ) : (
          state.items.map((item) => (
            <article className="row" key={item.id}>
              <div className="file">
                <strong>{item.relativePath}</strong>
                <span>
                  {formatBytes(item.file.size)} · {statusLabel[item.status]} · 재시도 {item.retryCount}/3
                </span>
                {item.error && <em>{item.error}</em>}
              </div>
              <div className="uploadMetrics">
                <div className="progress" aria-label={`${Math.round(item.progress)}%`}>
                  <span style={{ width: `${item.progress}%` }} />
                </div>
                <span>
                  {Math.round(item.progress)}% · {item.speedMbps.toFixed(2)} MB/s · ETA {formatEta(item.etaSeconds)}
                </span>
              </div>
              <div className="actions">
                {item.status === 'uploading' && <button onClick={() => pause(item.id)}>일시정지</button>}
                {item.status === 'paused' && <button onClick={() => resume(item.id)}>재개</button>}
                {item.status === 'failed' && <button onClick={() => retry(item.id)}>재시도</button>}
                {!terminalStatuses.has(item.status) && <button onClick={() => cancel(item.id)}>취소</button>}
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  );
}

function reducer(state: UploadState, action: Action): UploadState {
  switch (action.type) {
    case 'add-files':
      return {
        items: [
          ...state.items,
          ...action.files.map((file) => ({
            id: crypto.randomUUID(),
            file,
            relativePath: getRelativePath(file),
            status: 'pending' as const,
            progress: 0,
            speedMbps: 0,
            etaSeconds: null,
            retryCount: 0
          }))
        ]
      };
    case 'patch-item':
      return {
        items: state.items.map((item) => (item.id === action.id ? { ...item, ...action.patch } : item))
      };
    case 'cancel-all':
      return {
        items: state.items.map((item) =>
          terminalStatuses.has(item.status) ? item : { ...item, status: 'cancelled', speedMbps: 0, etaSeconds: null }
        )
      };
    case 'clear-finished':
      return {
        items: state.items.filter((item) => !terminalStatuses.has(item.status))
      };
    default:
      return state;
  }
}

function getRelativePath(file: File) {
  return (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function sizeInMb(bytes: number) {
  return Math.max(0.01, bytes / 1024 / 1024);
}

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(1)} ${units[index]}`;
}

function formatEta(seconds: number | null) {
  if (seconds === null || !Number.isFinite(seconds)) return '-';
  if (seconds <= 1) return '1초 미만';
  if (seconds < 60) return `${Math.ceil(seconds)}초`;
  return `${Math.floor(seconds / 60)}분 ${Math.ceil(seconds % 60)}초`;
}
