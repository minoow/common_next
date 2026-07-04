const originalFetch = window.fetch.bind(window);

const wait = (ms: number, signal?: AbortSignal | null) =>
  new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      window.clearTimeout(timer);
      reject(new DOMException('Upload canceled', 'AbortError'));
    });
  });

export function installMockApi() {
  window.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);

    if (url.endsWith('/api/uploads') && init?.method === 'POST') {
      await wait(650 + Math.random() * 900, init.signal);

      if (Math.random() < 0.18) {
        return Response.json({ message: '일시적인 네트워크 오류가 발생했습니다.' }, { status: 503 });
      }

      return Response.json({
        id: crypto.randomUUID(),
        uploadedAt: new Date().toISOString()
      });
    }

    return originalFetch(input, init);
  };
}
