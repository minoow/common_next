import { expect, type Page, test } from '@playwright/test';

async function gotoWithActiveMsw(page: Page, url: string) {
  await page.goto(url);
  await expect(page.locator('h1')).toBeVisible();
  await page.waitForFunction(() => navigator.serviceWorker.ready.then((registration) => Boolean(registration.active)));
  await page.reload();
  await expect(page.locator('h1')).toBeVisible();
}

test.describe('MSW mock API', () => {
  test('과제1 업로드 API가 MSW 응답을 반환한다', async ({ page }) => {
    await gotoWithActiveMsw(page, 'http://127.0.0.1:5173');

    const result = await page.evaluate(async () => {
      const formData = new FormData();
      formData.append('file', new File([new ArrayBuffer(1024)], 'api-test.bin'));
      const response = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await response.json();
      return { ok: response.ok, status: response.status, data };
    });

    expect([200, 503]).toContain(result.status);
    expect(result.data).toEqual(
      result.ok
        ? expect.objectContaining({
            id: expect.any(String),
            fileName: 'api-test.bin',
            fileSize: 1024,
            progress: 100,
            status: 'completed'
          })
        : expect.objectContaining({ message: expect.any(String) })
    );
  });

  test('과제2 파일 목록 API가 5,000개 이상 데이터를 반환한다', async ({ page }) => {
    await gotoWithActiveMsw(page, 'http://127.0.0.1:5174');

    const result = await page.evaluate(async () => {
      const response = await fetch('/api/files');
      const data = await response.json();
      return { status: response.status, count: data.files.length, first: data.files[0] };
    });

    expect(result.status).toBe(200);
    expect(result.count).toBeGreaterThanOrEqual(5000);
    expect(result.first).toEqual(expect.objectContaining({ id: expect.any(String), name: expect.any(String) }));
  });

  test('과제3 청크 업로드 세션 API가 세션을 생성하고 재조회한다', async ({ page }) => {
    await gotoWithActiveMsw(page, 'http://127.0.0.1:5175');

    const result = await page.evaluate(async () => {
      const payload = {
        fileKey: `playwright-${Date.now()}`,
        fileName: 'playwright.bin',
        fileSize: 2048,
        chunkSize: 1024,
        totalChunks: 2
      };
      const createResponse = await fetch('/api/chunk-upload/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const created = await createResponse.json();
      const readResponse = await fetch(`/api/chunk-upload/session/${created.id}`);
      const read = await readResponse.json();
      return { createStatus: createResponse.status, readStatus: readResponse.status, created, read };
    });

    expect(result.createStatus).toBe(200);
    expect(result.readStatus).toBe(200);
    expect(result.read).toEqual(expect.objectContaining({ id: result.created.id, totalChunks: 2, completed: [] }));
  });
});
