# 과제 3: 청크 기반 대용량 업로드

## 문제 분석

대용량 파일은 한 번의 요청으로 업로드하면 실패 시 처음부터 다시 보내야 합니다. 파일을 일정 크기의 청크로 나누고, 서버가 완료한 청크 목록을 기준으로 누락된 청크만 업로드해야 재개 가능한 업로드가 됩니다.

## 기술적 선택

- 파일을 1MB 청크로 분할했습니다.
- mock API는 MSW handler로 업로드 세션 생성, 상태 조회, 청크 업로드, 완료 처리를 담당합니다.
- 완료된 청크 index와 session id를 `localStorage`에 저장해 새로고침 후 재개할 수 있습니다.
- 청크별 retry를 최대 3회 수행하고, 실패 시 사용자가 다시 이어서 업로드할 수 있게 했습니다.

## 아키텍처

- `src/main.tsx`: 앱 진입점
- `src/App.tsx`: 파일 선택, 청크 업로드 오케스트레이션, 재개 UI
- `src/mockApi.ts`: resumable upload MSW handlers
- `../shared/mock/browser.ts`: MSW worker 공통 시작 로직
- `src/styles.css`: 업로드 상태 UI

## 개선하고 싶은 부분

- 실제 서비스에서는 파일 fingerprint를 SHA-256 등으로 계산해 같은 파일 식별 정확도를 높일 수 있습니다.
- 청크 병렬 업로드와 backoff 전략을 추가하면 처리량과 복구성이 좋아집니다.
- IndexedDB에 파일 핸들을 보관하는 방식으로 새로고침 후 파일 재선택 없이 재개하는 UX를 검토할 수 있습니다.

## 사용 도구

- React
- TypeScript
- Vite
- MSW
- AI 코딩 도구: ChatGPT/Codex

## 실행 방법

```bash
make install
make run3
```

## 테스트

루트에서 Playwright 기반 기능/API 테스트를 실행할 수 있습니다.

```bash
make test
```
