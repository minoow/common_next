import { useEffect, useMemo, useState } from 'react';
import type { FileNode } from './mockApi';

type SortKey = 'name' | 'size' | 'updatedAt';

const rowHeight = 48;
const viewportHeight = 620;
const overscan = 8;

export function App() {
  const [files, setFiles] = useState<FileNode[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(['folder-0', 'folder-1', 'folder-2']));
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [scrollTop, setScrollTop] = useState(0);

  useEffect(() => {
    fetch('/api/files')
      .then((response) => response.json())
      .then((data: { files: FileNode[] }) => setFiles(data.files));
  }, []);

  const childrenByParent = useMemo(() => {
    const map = new Map<string | null, FileNode[]>();
    for (const file of files) {
      const siblings = map.get(file.parentId) ?? [];
      siblings.push(file);
      map.set(file.parentId, siblings);
    }
    return map;
  }, [files]);

  const visibleFiles = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const sortNodes = (nodes: FileNode[]) =>
      [...nodes].sort((a, b) => {
        if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
        if (sortKey === 'size') return b.size - a.size;
        if (sortKey === 'updatedAt') return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
        return a.name.localeCompare(b.name);
      });

    const rows: Array<FileNode & { depth: number }> = [];
    const walk = (parentId: string | null, depth: number) => {
      for (const node of sortNodes(childrenByParent.get(parentId) ?? [])) {
        const matches = !normalized || node.name.toLowerCase().includes(normalized);
        const childMatches = node.type === 'folder' && hasMatchingChild(node.id, normalized, childrenByParent);

        if (matches || childMatches) {
          rows.push({ ...node, depth });
        }
        if (node.type === 'folder' && (expanded.has(node.id) || normalized) && (matches || childMatches)) {
          walk(node.id, depth + 1);
        }
      }
    };

    walk(null, 0);
    return rows;
  }, [childrenByParent, expanded, query, sortKey]);

  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const visibleCount = Math.ceil(viewportHeight / rowHeight) + overscan * 2;
  const virtualRows = visibleFiles.slice(startIndex, startIndex + visibleCount);

  const toggle = (id: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <main className="shell">
      <section className="header">
        <div>
          <p className="eyebrow">Task 2</p>
          <h1>대용량 파일 목록</h1>
        </div>
        <div className="metric">
          <span>전체 데이터</span>
          <strong>{files.length.toLocaleString()}개</strong>
        </div>
      </section>

      <section className="toolbar">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="파일명 검색" />
        <select value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)}>
          <option value="name">이름순</option>
          <option value="size">크기순</option>
          <option value="updatedAt">수정일순</option>
        </select>
        <span>표시 대상 {visibleFiles.length.toLocaleString()}개 · 렌더링 row {virtualRows.length}개</span>
      </section>

      <section className="table">
        <div className="thead">
          <span>이름</span>
          <span>크기</span>
          <span>수정일</span>
        </div>
        <div className="viewport" style={{ height: viewportHeight }} onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}>
          <div className="spacer" style={{ height: visibleFiles.length * rowHeight }}>
            {virtualRows.map((file, index) => (
              <div
                className="row"
                key={file.id}
                style={{ transform: `translateY(${(startIndex + index) * rowHeight}px)` }}
              >
                <button
                  className="name"
                  style={{ paddingLeft: 12 + file.depth * 24 }}
                  onClick={() => file.type === 'folder' && toggle(file.id)}
                >
                  <span className={`icon ${file.type}`}>{file.type === 'folder' ? (expanded.has(file.id) ? '▾' : '▸') : '·'}</span>
                  <strong>{file.name}</strong>
                </button>
                <span>{file.type === 'folder' ? '-' : formatBytes(file.size)}</span>
                <span>{new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' }).format(new Date(file.updatedAt))}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function hasMatchingChild(parentId: string, query: string, map: Map<string | null, FileNode[]>) {
  if (!query) return false;
  for (const child of map.get(parentId) ?? []) {
    if (child.name.toLowerCase().includes(query)) return true;
    if (child.type === 'folder' && hasMatchingChild(child.id, query, map)) return true;
  }
  return false;
}

function formatBytes(bytes: number) {
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(1)} ${units[index]}`;
}

