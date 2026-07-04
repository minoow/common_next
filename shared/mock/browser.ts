type MockWorker = {
  start: (options?: Record<string, unknown>) => Promise<ServiceWorkerRegistration | undefined>;
};

let started = false;

export async function startMockServer(worker: MockWorker) {
  if (started) {
    return;
  }

  started = true;
  await worker.start({
    onUnhandledRequest: 'bypass',
    serviceWorker: {
      url: '/mockServiceWorker.js'
    }
  });
}
