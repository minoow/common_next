import { delay, http, HttpResponse } from 'msw';

type MockUploadStatus = 'pending' | 'uploading' | 'paused' | 'completed' | 'failed' | 'cancelled';

type MockUpload = {
  id: string;
  fileName: string;
  fileSize: number;
  progress: number;
  status: MockUploadStatus;
};

const uploads = new Map<string, MockUpload>();

export const handlers = [
  http.post('/api/upload', async ({ request }) => {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return HttpResponse.json({ message: 'file 필드가 필요합니다.' }, { status: 400 });
    }

    const uploadId = formData.get('uploadId');
    const id = typeof uploadId === 'string' && uploadId ? uploadId : crypto.randomUUID();
    const upload: MockUpload = {
      id,
      fileName: file.name,
      fileSize: file.size,
      progress: 0,
      status: 'uploading'
    };

    uploads.set(id, upload);

    await delay(Math.max(100, (file.size / 1024 / 1024) * randomBetween(100, 200)));

    const latest = uploads.get(id);
    if (latest?.status === 'paused') {
      return HttpResponse.json(latest);
    }
    if (latest?.status === 'cancelled') {
      return HttpResponse.json(latest, { status: 409 });
    }

    if (Math.random() < 0.1) {
      upload.status = 'failed';
      uploads.set(id, upload);
      return HttpResponse.json({ message: '네트워크 오류가 발생했습니다.' }, { status: 503 });
    }

    upload.progress = 100;
    upload.status = 'completed';
    uploads.set(id, upload);

    return HttpResponse.json(upload);
  }),

  http.delete('/api/upload/:id', ({ params }) => {
    const upload = uploads.get(String(params.id));
    if (upload) {
      upload.status = 'cancelled';
      uploads.set(upload.id, upload);
    }

    return HttpResponse.json({ success: Boolean(upload) });
  }),

  http.post('/api/upload/:id/pause', ({ params }) => {
    const upload = uploads.get(String(params.id));
    if (!upload) {
      return HttpResponse.json({ success: false, message: '업로드를 찾을 수 없습니다.' }, { status: 404 });
    }

    upload.status = 'paused';
    uploads.set(upload.id, upload);
    return HttpResponse.json({ success: true, status: 'paused' });
  }),

  http.post('/api/upload/:id/resume', ({ params }) => {
    const upload = uploads.get(String(params.id));
    if (!upload) {
      return HttpResponse.json({ success: false, message: '업로드를 찾을 수 없습니다.' }, { status: 404 });
    }

    upload.status = 'uploading';
    uploads.set(upload.id, upload);
    return HttpResponse.json({ success: true, status: 'uploading' });
  })
];

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}
