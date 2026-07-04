import { useEffect, useMemo, useRef, useState } from 'react';

type UploadStatus = 'queued' | 'uploading' | 'done' | 'failed' | 'canceled';

type UploadItem = {
  id: string;
  file: File;
  status: UploadStatus;
  progress: number;
  error?: string;
};

const statusLabel: Record<UploadStatus, string> = {
  queued: '대기',
  uploading: '업로드 중',
  done: '완료',
  failed: '실패',
  canceled: '취소됨'
};

export function App() {
  const [items, setItems] = useState<UploadItem[]>([]);
  const activeController = useRef<AbortController | null>(null);
  const activeId = useRef<string | null>(null);
  const hasUploading = items.some((item) => item.status === 'uploading');
  const nextQueued = items.find((item) => item.status === 'queued');

  const summary = useMemo(() => {
    return items.reduce(
      (acc, item) => ({ ...acc, [item.status]: acc[item.status] + 1 }),
      { queued: 0, uploading: 0, done: 0, failed: 0, canceled: 0 } as Record<UploadStatus, number>
    );
  }, [items]);

  useEffect(() => {
    if (hasUploading || !nextQueued) {
      return;
    }

    const controller = new AbortController();
    activeController.current = controller;
    activeId.current = nextQueued.id;

    setItems((current) =>
      current.map((item) =>
        item.id === nextQueued.id ? { ...item, status: 'uploading', progress: 8, error: undefined } : item
      )
    );

    let progress = 8;
    const timer = window.setInterval(() => {
      progress = Math.min(progress + 6 + Math.random() * 12, 92);
      setItems((current) =>
        current.map((item) => (item.id === nextQueued.id ? { ...item, progress } : item))
      );
    }, 220);

    const body = new FormData();
    body.append('file', nextQueued.file);

    fetch('/api/uploads', { method: 'POST', body, signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.message ?? '업로드에 실패했습니다.');
        }
        setItems((current) =>
          current.map((item) =>
            item.id === nextQueued.id ? { ...item, status: 'done', progress: 100 } : item
          )
        );
      })
      .catch((error: Error) => {
        setItems((current) =>
          current.map((item) => {
            if (item.id !== nextQueued.id) return item;
            if (error.name === 'AbortError') return { ...item, status: 'canceled', progress: 0 };
            return { ...item, status: 'failed', error: error.message, progress };
          })
        );
      })
      .finally(() => {
        window.clearInterval(timer);
        activeController.current = null;
        activeId.current = null;
      });
  }, [hasUploading, nextQueued]);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const nextItems = Array.from(files).map((file) => ({
      id: crypto.randomUUID(),
      file,
      status: 'queued' as const,
      progress: 0
    }));
    setItems((current) => [...current, ...nextItems]);
  };

  const cancel = (id: string) => {
    if (activeId.current === id) {
      activeController.current?.abort();
      return;
    }

    setItems((current) =>
      current.map((item) => (item.id === id && item.status === 'queued' ? { ...item, status: 'canceled' } : item))
    );
  };

  const retry = (id: string) => {
    setItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, status: 'queued', progress: 0, error: undefined } : item
      )
    );
  };

  const clearFinished = () => {
    setItems((current) => current.filter((item) => item.status === 'queued' || item.status === 'uploading'));
  };

  return (
    <main className="shell">
      <section className="header">
        <div>
          <p className="eyebrow">Task 1</p>
          <h1>멀티 파일 업로드 큐</h1>
        </div>
        <button onClick={clearFinished}>완료 항목 정리</button>
      </section>

      <label className="dropzone">
        <input multiple type="file" onChange={(event) => addFiles(event.target.files)} />
        <strong>파일 선택</strong>
        <span>여러 파일을 선택하면 큐에 추가되고 한 번에 하나씩 업로드됩니다.</span>
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
        {items.length === 0 ? (
          <p className="empty">아직 큐에 파일이 없습니다.</p>
        ) : (
          items.map((item) => (
            <article className="row" key={item.id}>
              <div className="file">
                <strong>{item.file.name}</strong>
                <span>{formatBytes(item.file.size)} · {statusLabel[item.status]}</span>
                {item.error && <em>{item.error}</em>}
              </div>
              <div className="progress" aria-label={`${Math.round(item.progress)}%`}>
                <span style={{ width: `${item.progress}%` }} />
              </div>
              <div className="actions">
                {(item.status === 'queued' || item.status === 'uploading') && (
                  <button onClick={() => cancel(item.id)}>취소</button>
                )}
                {(item.status === 'failed' || item.status === 'canceled') && (
                  <button onClick={() => retry(item.id)}>재시도</button>
                )}
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  );
}

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(1)} ${units[index]}`;
}

