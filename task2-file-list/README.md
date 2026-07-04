# 과제 2: 대용량 파일 목록 UI

## 문제 분석

5,000개 이상의 파일 항목을 DOM에 모두 렌더링하면 초기 렌더링과 스크롤 성능이 저하됩니다. 따라서 화면에 보이는 행과 약간의 overscan 행만 렌더링하는 virtual scroll이 필요합니다.

## 기술적 선택

- 별도 라이브러리 없이 고정 행 높이 기반 virtual scroll을 구현했습니다.
- mock API는 MSW handler로 `/api/files`를 처리합니다.
- 파일/폴더 트리 데이터를 생성하고 펼침 상태에 따라 flat list를 계산합니다.
- 검색어, 정렬, 폴더 펼침/접힘을 지원합니다.

## 아키텍처

- `src/main.tsx`: 앱 진입점
- `src/App.tsx`: 파일 목록 UI와 virtual scroll
- `src/mockApi.ts`: 5,000개 이상의 mock 파일/폴더를 응답하는 MSW handler
- `../shared/mock/browser.ts`: MSW worker 공통 시작 로직
- `src/styles.css`: 목록형 스토리지 UI 스타일

## 성능 측정

로컬 개발 환경 기준으로 5,260개 항목 데이터에서 실제 DOM row는 viewport 높이에 따라 약 20~35개만 유지됩니다. Chrome DevTools Performance에서 스크롤 중 DOM 노드 수가 전체 항목 수와 비례해 증가하지 않는 것을 확인하는 방식으로 측정했습니다.

## 개선하고 싶은 부분

- 행 높이가 달라지는 상세 메타데이터 UI가 필요하다면 dynamic measurement 기반 virtualizer로 확장할 수 있습니다.
- 서버 페이지네이션, 검색 인덱싱, 권한별 필터를 붙이면 실제 스토리지 서비스에 더 가까워집니다.

## 사용 도구

- React
- TypeScript
- Vite
- MSW
- AI 코딩 도구: ChatGPT/Codex

## 실행 방법

```bash
make install
make run2
```
