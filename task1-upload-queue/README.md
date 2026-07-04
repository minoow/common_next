# 과제 1: 멀티 파일 업로드 큐 시스템

## 문제 분석

여러 파일을 한 번에 선택하더라도 실제 업로드는 안정성을 위해 순차적으로 처리되어야 합니다. 사용자는 각 파일의 현재 상태를 알아야 하며, 업로드 중인 파일 또는 대기 중인 파일을 개별 취소할 수 있어야 합니다.

## 기술적 선택

- React state와 `useEffect` 기반 큐 워커를 사용했습니다.
- 실제 API 서버 대신 MSW handler로 mock API를 구현했습니다.
- `AbortController`로 업로드 중 취소를 처리했습니다.
- mock API에서 지연과 확률적 실패를 넣어 실패/재시도 플로우를 확인할 수 있게 했습니다.

## 아키텍처

- `src/main.tsx`: 앱 진입점
- `src/App.tsx`: 업로드 큐 상태와 UI
- `src/mockApi.ts`: `/api/uploads` 요청을 처리하는 MSW handler
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
