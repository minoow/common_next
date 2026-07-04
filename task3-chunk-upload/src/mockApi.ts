type ServerSession = {
  id: string;
  fileKey: string;
  fileName: string;
  fileSize: number;
  chunkSize: number;
  totalChunks: number;
  completed: number[];
  status: 'active' | 'completed';
};

const originalFetch = window.fetch.bind(window);
const storageKey = 'task3.mock.sessions';

function readSessions(): ServerSession[] {
  return JSON.parse(localStorage.getItem(storageKey) ?? '[]') as ServerSession[];
}

function writeSessions(sessions: ServerSession[]) {
  localStorage.setItem(storageKey, JSON.stringify(sessions));
}

async function wait(ms: number, signal?: AbortSignal | null) {
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      window.clearTimeout(timer);
      reject(new DOMException('Upload canceled', 'AbortError'));
    });
  });
}

export function installMockApi() {
  window.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    const requestUrl = new URL(url, window.location.origin);

    if (requestUrl.pathname === '/api/chunk-upload/session' && init?.method === 'POST') {
      const payload = JSON.parse(String(init.body)) as Omit<ServerSession, 'id' | 'completed' | 'status'>;
      const sessions = readSessions();
      const existing = sessions.find((session) => session.fileKey === payload.fileKey && session.status === 'active');

      if (existing) {
        return Response.json(existing);
      }

      const session: ServerSession = {
        ...payload,
        id: crypto.randomUUID(),
        completed: [],
        status: 'active'
      };
      writeSessions([...sessions, session]);
      return Response.json(session);
    }

    if (requestUrl.pathname.startsWith('/api/chunk-upload/session/') && init?.method === 'GET') {
      const pathParts = requestUrl.pathname.split('/');
      const id = pathParts[pathParts.length - 1];
      const session = readSessions().find((item) => item.id === id);
      return session ? Response.json(session) : Response.json({ message: '세션을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (requestUrl.pathname.endsWith('/chunk') && init?.method === 'PUT') {
      await wait(180 + Math.random() * 420, init.signal);
      if (Math.random() < 0.12) {
        return Response.json({ message: '청크 업로드 중 네트워크 오류가 발생했습니다.' }, { status: 503 });
      }

      const parts = requestUrl.pathname.split('/');
      const sessionId = parts[3];
      const chunkIndex = Number(requestUrl.searchParams.get('index'));
      const sessions = readSessions();
      const session = sessions.find((item) => item.id === sessionId);

      if (!session) {
        return Response.json({ message: '세션을 찾을 수 없습니다.' }, { status: 404 });
      }

      if (!session.completed.includes(chunkIndex)) {
        session.completed.push(chunkIndex);
        session.completed.sort((a, b) => a - b);
        writeSessions(sessions);
      }

      return Response.json({ completed: session.completed });
    }

    if (requestUrl.pathname.endsWith('/complete') && init?.method === 'POST') {
      const sessionId = requestUrl.pathname.split('/')[3];
      const sessions = readSessions();
      const session = sessions.find((item) => item.id === sessionId);

      if (!session) {
        return Response.json({ message: '세션을 찾을 수 없습니다.' }, { status: 404 });
      }

      if (session.completed.length !== session.totalChunks) {
        return Response.json({ message: '아직 업로드되지 않은 청크가 있습니다.' }, { status: 409 });
      }

      session.status = 'completed';
      writeSessions(sessions);
      return Response.json({ ok: true, completedAt: new Date().toISOString() });
    }

    return originalFetch(input, init);
  };
}
