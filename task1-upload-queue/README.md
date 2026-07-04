# 과제 1: 멀티 파일 업로드 큐 시스템

## 문제 분석

여러 파일을 한 번에 선택하더라도 실제 업로드는 안정성을 위해 순차적으로 처리되어야 합니다. 사용자는 각 파일의 현재 상태를 알아야 하며, 업로드 중인 파일 또는 대기 중인 파일을 개별 취소할 수 있어야 합니다.

## 기술적 선택

- React `useReducer`와 `useEffect` 기반 큐 워커를 사용했습니다.
- 실제 API 서버 대신 MSW handler로 mock API를 구현했습니다.
- `AbortController`로 업로드 중 취소를 처리했습니다.
- mock API에서 MB 단위 랜덤 지연, 10% 네트워크 실패, pause/resume/cancel 상태 반영을 처리했습니다.
- 실패 시 1초, 2초, 4초 exponential backoff로 최대 3회 자동 재시도합니다.

## 구현 기능

- 여러 파일 선택 및 드래그앤드롭 대기열 추가
- `webkitdirectory` 기반 폴더 업로드
- 상태 관리: `pending`, `uploading`, `paused`, `completed`, `failed`, `cancelled`
- 한 번에 하나씩 순차 업로드
- 진행률, 속도(MB/s), 예상 시간 표시
- 개별 취소, 전체 취소, 개별 일시정지/재개
- 실패 파일 수동 재시도

## Mock API

- `POST /api/upload`
- `DELETE /api/upload/:id`
- `POST /api/upload/:id/pause`
- `POST /api/upload/:id/resume`

## 아키텍처

- `src/main.tsx`: 앱 진입점
- `src/App.tsx`: 업로드 큐 reducer, 순차 업로드 워커, UI
- `src/mockApi.ts`: `/api/upload` 계열 요청을 처리하는 MSW handler
- `../shared/mock/browser.ts`: MSW worker 공통 시작 로직
- `src/styles.css`: 과제 UI 스타일

## 개선하고 싶은 부분

- 실제 서비스라면 서버에서 발급한 upload id와 presigned URL을 사용하는 구조로 확장할 수 있습니다.
- 업로드 큐의 동시성 개수를 사용자가 선택할 수 있게 개선할 수 있습니다.
- 실패 원인을 세분화하고 파일 타입/용량 검증을 추가할 수 있습니다.

## 사용 도구

- React
- TypeScript
- Vite
- MSW
- AI 코딩 도구: ChatGPT/Codex

## 실행 방법

```bash
make install
make run1
```

## 테스트

루트에서 Playwright 기반 기능/API 테스트를 실행할 수 있습니다.

```bash
make test
```
