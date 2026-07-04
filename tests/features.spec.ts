import { expect, test } from '@playwright/test';

test.describe('과제 기능 플로우', () => {
  test('과제1: 파일을 큐에 추가하고 업로드 상태를 표시한다', async ({ page }) => {
    await page.goto('http://127.0.0.1:5173');

    await page.getByTestId('file-input').setInputFiles([
      {
        name: 'first.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('first file')
      },
      {
        name: 'second.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('second file')
      }
    ]);

    await expect(page.getByText('first.txt')).toBeVisible();
    await expect(page.getByText('second.txt')).toBeVisible();
    await expect(page.getByText(/업로드 중|완료|실패|자동 재시도/).first()).toBeVisible();
    await expect(page.getByText(/MB\/s|ETA/).first()).toBeVisible();
    await expect(page.getByRole('button', { name: '전체 취소' })).toBeVisible();
  });

  test('과제2: 10,000개 목록, 검색, 선택, 트리/그리드 전환이 동작한다', async ({ page }) => {
    await page.goto('http://127.0.0.1:5174');

    await expect(page.getByText('전체 데이터')).toBeVisible();
    await expect(page.getByText('18,380개')).toBeVisible();
    await expect(page.getByText('표시 10,000개')).toBeVisible();

    await page.getByPlaceholder('파일명 검색').fill('visual-bulk-00001');
    await expect(page.getByText('visual-bulk-00001.png')).toBeVisible();
    await expect(page.locator('mark')).toBeVisible();

    const renderedRows = await page.locator('.row').count();
    expect(renderedRows).toBeLessThan(80);

    await page.getByPlaceholder('파일명 검색').fill('');
    await page.locator('select').first().selectOption('image');
    await expect(page.getByText('표시 1,667개')).toBeVisible();

    await page.locator('.row').first().click();
    await expect(page.getByText(/선택 1개/)).toBeVisible();
    await page.locator('.row').nth(2).click({ modifiers: ['Shift'] });
    await expect(page.getByText(/선택 3개/)).toBeVisible();

    await page.getByRole('button', { name: '트리' }).click();
    await expect(page.locator('.row').filter({ hasText: 'Bulk Workspace' })).toBeVisible();

    await page.getByRole('button', { name: '그리드' }).click();
    await expect(page.locator('.card').first()).toBeVisible();
  });

  test('과제3: 파일 선택 후 청크 업로드를 완료한다', async ({ page }) => {
    await page.goto('http://127.0.0.1:5175');
    await page.getByRole('button', { name: '초기화' }).click();

    await page.locator('input[type="file"]').setInputFiles({
      name: 'large.bin',
      mimeType: 'application/octet-stream',
      buffer: Buffer.alloc(1024 * 1024 + 128, 1)
    });

    await expect(page.getByText('large.bin')).toBeVisible();
    await expect(page.getByText('청크: 0/2')).toBeVisible();

    await page.getByRole('button', { name: '업로드 / 재개' }).click();

    await expect(page.getByText('completed')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('100%')).toBeVisible();
    await expect(page.getByText('청크: 2/2')).toBeVisible();
  });
});
