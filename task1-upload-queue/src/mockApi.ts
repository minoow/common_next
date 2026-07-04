import { delay, http, HttpResponse } from 'msw';

export const handlers = [
  http.post('/api/uploads', async () => {
    await delay(650 + Math.random() * 900);

    if (Math.random() < 0.18) {
      return HttpResponse.json({ message: '일시적인 네트워크 오류가 발생했습니다.' }, { status: 503 });
    }

    return HttpResponse.json({
      id: crypto.randomUUID(),
      uploadedAt: new Date().toISOString()
    });
  })
];
