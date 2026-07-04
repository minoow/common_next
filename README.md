# 42Tape Frontend Developer 기술 과제

42Tape 프론트엔드 기술 과제 풀이입니다. 각 과제는 독립적인 Vite + React + TypeScript 프로젝트로 구성했습니다.

## 로컬 실행 방법

```bash
# 의존성 설치
make install

# 과제 1: 멀티 파일 업로드 큐
make run1

# 과제 2: 대용량 파일 목록 UI
make run2

# 과제 3: 청크 기반 대용량 업로드
make run3
```

각 실행 명령은 Vite 개발 서버를 띄우며, 터미널에 표시되는 localhost URL로 접속하면 됩니다.

## 구현 방식 요약

- `task1-upload-queue`: 여러 파일을 큐에 추가하고 순차 업로드, 취소, 재시도, 실패 처리를 구현했습니다.
- `task2-file-list`: 5,000개 이상의 파일/폴더 데이터를 생성하고, 직접 구현한 virtual scroll로 렌더링 비용을 제한했습니다.
- `task3-chunk-upload`: 파일을 청크로 분할하고, 업로드 세션/완료 청크 정보를 `localStorage`에 저장해 새로고침 후 재개할 수 있게 했습니다.

## Mocking 전략

실제 백엔드가 없으므로 각 과제에서 자체 `fetch` interceptor 기반 mock API를 사용했습니다. 네트워크 요청에 가까운 형태로 `fetch`를 호출하며, mock 레이어에서 지연, 실패, 취소, 세션 조회, 청크 업로드 응답을 시뮬레이션합니다.

## 사용 도구

- React
- TypeScript
- Vite
- AI 코딩 도구: ChatGPT/Codex

