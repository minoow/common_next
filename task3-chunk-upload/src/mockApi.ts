import { delay, http, HttpResponse } from 'msw';

type UploadStatus = 'initialized' | 'uploading' | 'completed';

type StoredUpload = {
  uploadId: string;
  fileKey: string;
  fileName: string;
  fileSize: number;
  chunkSize: number;
  totalChunks: number;
  uploadedChunks: Record<string, { uploaded: true; timestamp: number; size: number }>;
  status: UploadStatus;
  completedAt?: string;
};

const indexKey = 'task3.mock.upload.index';

function uploadKey(uploadId: string) {
  return `upload_${uploadId}`;
}

function readIndex(): Record<string, string> {
  return JSON.parse(localStorage.getItem(indexKey) ?? '{}') as Record<string, string>;
}

function writeIndex(index: Record<string, string>) {
  localStorage.setItem(indexKey, JSON.stringify(index));
}

function readUpload(uploadId: string): StoredUpload | null {
  const raw = localStorage.getItem(uploadKey(uploadId));
  return raw ? (JSON.parse(raw) as StoredUpload) : null;
}

function writeUpload(upload: StoredUpload) {
  localStorage.setItem(uploadKey(upload.uploadId), JSON.stringify(upload));
  const index = readIndex();
  index[upload.fileKey] = upload.uploadId;
  writeIndex(index);
}

export const handlers = [
  http.post('/api/upload/init', async ({ request }) => {
    const payload = (await request.json()) as {
      fileKey: string;
      fileName: string;
      fileSize: number;
      chunkSize: number;
      totalChunks: number;
    };
    const existingId = readIndex()[payload.fileKey];
    const existing = existingId ? readUpload(existingId) : null;

    if (existing) {
      return HttpResponse.json(existing);
    }

    const upload: StoredUpload = {
      uploadId: crypto.randomUUID(),
      ...payload,
      uploadedChunks: {},
      status: 'initialized'
    };
    writeUpload(upload);
    return HttpResponse.json(upload);
  }),

  http.post('/api/upload/chunk', async ({ request }) => {
    const formData = await request.formData();
    const uploadId = String(formData.get('uploadId') ?? '');
    const chunkIndex = String(formData.get('chunkIndex') ?? '');
    const chunkSize = Number(formData.get('chunkSize') ?? 0);
    const upload = readUpload(uploadId);

    if (!upload) {
      return HttpResponse.json({ message: '업로드 상태를 찾을 수 없습니다.' }, { status: 404 });
    }

    await delay(100 + Math.random() * 400);

    if (Math.random() < 0.15) {
      return HttpResponse.json({ message: '청크 업로드 중 네트워크 오류가 발생했습니다.' }, { status: 503 });
    }

    const latest = readUpload(uploadId) ?? upload;
    latest.status = 'uploading';
    latest.uploadedChunks = {
      ...latest.uploadedChunks,
      [chunkIndex]: { uploaded: true, timestamp: Date.now(), size: chunkSize }
    };
    writeUpload(latest);

    return HttpResponse.json({
      success: true,
      uploadId,
      chunkIndex: Number(chunkIndex),
      uploadedChunks: latest.uploadedChunks
    });
  }),

  http.get('/api/upload/status/:uploadId', ({ params }) => {
    const upload = readUpload(String(params.uploadId));
    return upload
      ? HttpResponse.json(upload)
      : HttpResponse.json({ message: '업로드 상태를 찾을 수 없습니다.' }, { status: 404 });
  }),

  http.post('/api/upload/complete', async ({ request }) => {
    const payload = (await request.json()) as { uploadId: string };
    const upload = readUpload(payload.uploadId);

    if (!upload) {
      return HttpResponse.json({ message: '업로드 상태를 찾을 수 없습니다.' }, { status: 404 });
    }

    const completedCount = Object.keys(upload.uploadedChunks).length;
    if (completedCount !== upload.totalChunks) {
      return HttpResponse.json({ message: '아직 업로드되지 않은 청크가 있습니다.' }, { status: 409 });
    }

    upload.status = 'completed';
    upload.completedAt = new Date().toISOString();
    writeUpload(upload);

    return HttpResponse.json({ success: true, uploadId: upload.uploadId, completedAt: upload.completedAt });
  })
];
