import { delay, http, HttpResponse } from 'msw';

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

const storageKey = 'task3.mock.sessions';

function readSessions(): ServerSession[] {
  return JSON.parse(localStorage.getItem(storageKey) ?? '[]') as ServerSession[];
}

function writeSessions(sessions: ServerSession[]) {
  localStorage.setItem(storageKey, JSON.stringify(sessions));
}

export const handlers = [
  http.post('/api/chunk-upload/session', async ({ request }) => {
    const payload = (await request.json()) as Omit<ServerSession, 'id' | 'completed' | 'status'>;
    const sessions = readSessions();
    const existing = sessions.find((session) => session.fileKey === payload.fileKey && session.status === 'active');

    if (existing) {
      return HttpResponse.json(existing);
    }

    const session: ServerSession = {
      ...payload,
      id: crypto.randomUUID(),
      completed: [],
      status: 'active'
    };
    writeSessions([...sessions, session]);
    return HttpResponse.json(session);
  }),

  http.get('/api/chunk-upload/session/:sessionId', ({ params }) => {
    const id = String(params.sessionId);
    const session = readSessions().find((item) => item.id === id);
    return session ? HttpResponse.json(session) : HttpResponse.json({ message: '세션을 찾을 수 없습니다.' }, { status: 404 });
  }),

  http.put('/api/chunk-upload/session/:sessionId/chunk', async ({ params, request }) => {
    await delay(180 + Math.random() * 420);
    if (Math.random() < 0.12) {
      return HttpResponse.json({ message: '청크 업로드 중 네트워크 오류가 발생했습니다.' }, { status: 503 });
    }

    const requestUrl = new URL(request.url);
    const sessionId = String(params.sessionId);
    const chunkIndex = Number(requestUrl.searchParams.get('index'));
    const sessions = readSessions();
    const session = sessions.find((item) => item.id === sessionId);

    if (!session) {
      return HttpResponse.json({ message: '세션을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (!session.completed.includes(chunkIndex)) {
      session.completed.push(chunkIndex);
      session.completed.sort((a, b) => a - b);
      writeSessions(sessions);
    }

    return HttpResponse.json({ completed: session.completed });
  }),

  http.post('/api/chunk-upload/session/:sessionId/complete', ({ params }) => {
    const sessionId = String(params.sessionId);
    const sessions = readSessions();
    const session = sessions.find((item) => item.id === sessionId);

    if (!session) {
      return HttpResponse.json({ message: '세션을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (session.completed.length !== session.totalChunks) {
      return HttpResponse.json({ message: '아직 업로드되지 않은 청크가 있습니다.' }, { status: 409 });
    }

    session.status = 'completed';
    writeSessions(sessions);
    return HttpResponse.json({ ok: true, completedAt: new Date().toISOString() });
  })
];
