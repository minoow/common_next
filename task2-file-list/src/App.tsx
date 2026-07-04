import { CSSProperties, MouseEvent, useMemo, useState } from 'react';
import { Grid, List } from 'react-window';
import { createMockFileTree, type FileCategory, type FileNode } from './mockData';

type SortKey = 'name' | 'size' | 'modifiedAt';
type DisplayMode = 'flat' | 'tree';
type ViewMode = 'list' | 'grid';

type VisibleNode = FileNode & { depth: number };

type RowProps = {
  rows: VisibleNode[];
  expanded: Set<string>;
  selected: Set<string>;
  query: string;
  dropTargetId: string | null;
  onNavigate: (id: string) => void;
  onToggle: (id: string) => void;
  onSelect: (event: MouseEvent, index: number, id: string) => void;
  onDragStart: (id: string) => void;
  onDragOverFolder: (id: string) => void;
  onDropOnFolder: (id: string) => void;
};

type CellProps = RowProps & {
  columns: number;
};

const listHeight = 620;
const rowHeight = 52;
const gridRowHeight = 142;
const gridColumns = 4;

const categoryLabel: Record<FileCategory | 'all', string> = {
  all: '전체',
  folder: '폴더',
  image: '이미지',
  document: '문서',
  video: '동영상',
  archive: '압축',
  code: '코드',
  audio: '오디오'
};

const data = createMockFileTree();

export function App() {
  const [nodes, setNodes] = useState<FileNode[]>(data);
  const [currentFolderId, setCurrentFolderId] = useState('folder-bulk');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('flat');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(['folder-bulk', 'folder-products', 'folder-design', 'folder-media']));
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [dragIds, setDragIds] = useState<string[]>([]);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<FileCategory | 'all'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('name');

  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const childrenByParent = useMemo(() => {
    const map = new Map<string | null, FileNode[]>();
    for (const node of nodes) {
      const children = map.get(node.parentId) ?? [];
      children.push(node);
      map.set(node.parentId, children);
    }
    return map;
  }, [nodes]);

  const breadcrumb = useMemo(() => {
    const path: FileNode[] = [];
    let current = nodeById.get(currentFolderId);
    while (current) {
      path.unshift(current);
      current = current.parentId ? nodeById.get(current.parentId) : undefined;
    }
    return path;
  }, [currentFolderId, nodeById]);

  const rows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const matches = (node: FileNode) => {
      const categoryMatches = category === 'all' || node.category === category || (category === 'folder' && node.kind === 'folder');
      const queryMatches = !normalized || node.name.toLowerCase().includes(normalized);
      return categoryMatches && queryMatches;
    };
    const sortNodes = (items: FileNode[]) =>
      [...items].sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1;
        if (sortKey === 'size') return b.size - a.size;
        if (sortKey === 'modifiedAt') return Date.parse(b.modifiedAt) - Date.parse(a.modifiedAt);
        return a.name.localeCompare(b.name);
      });

    if (displayMode === 'flat') {
      return sortNodes(childrenByParent.get(currentFolderId) ?? [])
        .filter(matches)
        .map((node) => ({ ...node, depth: 0 }));
    }

    const visible: VisibleNode[] = [];
    const walk = (parentId: string | null, depth: number) => {
      for (const node of sortNodes(childrenByParent.get(parentId) ?? [])) {
        const descendantsMatch = node.kind === 'folder' && hasMatchingDescendant(node.id, childrenByParent, matches);
        if (matches(node) || descendantsMatch) {
          visible.push({ ...node, depth });
        }
        if (node.kind === 'folder' && (expanded.has(node.id) || Boolean(normalized)) && (matches(node) || descendantsMatch)) {
          walk(node.id, depth + 1);
        }
      }
    };
    walk(null, 0);
    return visible;
  }, [category, childrenByParent, currentFolderId, displayMode, expanded, query, sortKey]);

  const selectedNodes = useMemo(() => nodes.filter((node) => selected.has(node.id)), [nodes, selected]);
  const selectedSize = selectedNodes.reduce((total, node) => total + node.size, 0);
  const totalSize = nodes.reduce((total, node) => total + node.size, 0);
  const gridRowCount = Math.ceil(rows.length / gridColumns);

  const toggle = (id: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectRow = (event: MouseEvent, index: number, id: string) => {
    setSelected((current) => {
      if (event.shiftKey && lastSelectedIndex !== null) {
        const [start, end] = [lastSelectedIndex, index].sort((a, b) => a - b);
        const next = new Set(current);
        for (let i = start; i <= end; i += 1) next.add(rows[i].id);
        return next;
      }

      if (event.metaKey || event.ctrlKey) {
        const next = new Set(current);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }

      return new Set([id]);
    });
    setLastSelectedIndex(index);
  };

  const startDrag = (id: string) => {
    const ids = selected.has(id) ? [...selected] : [id];
    setDragIds(ids);
  };

  const dropOnFolder = (targetId: string) => {
    if (dragIds.length === 0) return;
    const movable = dragIds.filter((id) => id !== targetId && !isDescendant(targetId, id, nodeById));
    setNodes((current) => current.map((node) => (movable.includes(node.id) ? { ...node, parentId: targetId } : node)));
    setDropTargetId(null);
    setDragIds([]);
  };

  const deleteSelected = () => {
    const deleted = new Set(selected);
    setNodes((current) => current.filter((node) => !deleted.has(node.id)));
    setSelected(new Set());
  };

  const rowProps: RowProps = {
    rows,
    expanded,
    selected,
    query,
    dropTargetId,
    onNavigate: setCurrentFolderId,
    onToggle: toggle,
    onSelect: selectRow,
    onDragStart: startDrag,
    onDragOverFolder: setDropTargetId,
    onDropOnFolder: dropOnFolder
  };

  return (
    <main className="shell">
      <section className="header">
        <div>
          <p className="eyebrow">Task 2</p>
          <h1>대용량 파일 목록</h1>
        </div>
        <div className="metrics">
          <div><span>전체 데이터</span><strong>{nodes.length.toLocaleString()}개</strong></div>
          <div><span>총 용량</span><strong>{formatBytes(totalSize)}</strong></div>
        </div>
      </section>

      <nav className="breadcrumb" aria-label="breadcrumb">
        <button onClick={() => setCurrentFolderId('folder-bulk')}>Root</button>
        {breadcrumb.map((node) => (
          <button key={node.id} onClick={() => setCurrentFolderId(node.id)}>{node.name}</button>
        ))}
      </nav>

      <section className="toolbar">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="파일명 검색" />
        <select value={category} onChange={(event) => setCategory(event.target.value as FileCategory | 'all')}>
          {Object.entries(categoryLabel).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
        </select>
        <select value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)}>
          <option value="name">이름순</option>
          <option value="size">크기순</option>
          <option value="modifiedAt">수정일순</option>
        </select>
        <div className="segmented">
          <button className={displayMode === 'flat' ? 'active' : ''} onClick={() => setDisplayMode('flat')}>플랫</button>
          <button className={displayMode === 'tree' ? 'active' : ''} onClick={() => setDisplayMode('tree')}>트리</button>
        </div>
        <div className="segmented">
          <button className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')}>리스트</button>
          <button className={viewMode === 'grid' ? 'active' : ''} onClick={() => setViewMode('grid')}>그리드</button>
        </div>
      </section>

      <section className="selectionBar">
        <span>현재 위치: {breadcrumb[breadcrumb.length - 1]?.name ?? 'Root'}</span>
        <span>표시 {rows.length.toLocaleString()}개</span>
        <span>선택 {selected.size.toLocaleString()}개 · {formatBytes(selectedSize)}</span>
        <span>렌더링 row는 viewport + overscan만 유지</span>
        <button disabled={selected.size === 0} onClick={deleteSelected}>선택 삭제</button>
      </section>

      {dragIds.length > 0 && <div className="dragBadge">드래그 중 {dragIds.length}개</div>}

      {viewMode === 'list' ? (
        <section className="table">
          <div className="thead">
            <span>이름</span>
            <span>타입</span>
            <span>크기</span>
            <span>수정일</span>
          </div>
          <List
            key={`list-${displayMode}-${currentFolderId}-${category}-${query}-${sortKey}`}
            className="virtualList"
            defaultHeight={listHeight}
            rowComponent={ListRow as never}
            rowCount={rows.length}
            rowHeight={rowHeight}
            rowProps={rowProps as never}
            overscanCount={12}
            style={{ height: listHeight }}
          />
        </section>
      ) : (
        <section className="gridSurface">
          <Grid
            key={`grid-${displayMode}-${currentFolderId}-${category}-${query}-${sortKey}`}
            className="virtualGrid"
            cellComponent={GridCell as never}
            cellProps={{ ...rowProps, columns: gridColumns } as never}
            columnCount={gridColumns}
            columnWidth="25%"
            rowCount={gridRowCount}
            rowHeight={gridRowHeight}
            overscanCount={6}
            style={{ height: listHeight }}
          />
        </section>
      )}
    </main>
  );
}

function ListRow({ index, style, rows, ...props }: { index: number; style: CSSProperties } & RowProps) {
  const node = rows[index];
  return (
    <div style={style}>
      <FileRow node={node} index={index} {...props} />
    </div>
  );
}

function GridCell({ columnIndex, rowIndex, style, rows, columns, ...props }: { columnIndex: number; rowIndex: number; style: CSSProperties } & CellProps) {
  const index = rowIndex * columns + columnIndex;
  const node = rows[index];
  if (!node) return null;

  return (
    <div style={style}>
      <FileCard node={node} index={index} {...props} />
    </div>
  );
}

function FileRow({
  node,
  index,
  expanded,
  selected,
  query,
  dropTargetId,
  onNavigate,
  onToggle,
  onSelect,
  onDragStart,
  onDragOverFolder,
  onDropOnFolder
}: Omit<RowProps, 'rows'> & { node: VisibleNode; index: number }) {
  const isSelected = selected.has(node.id);
  const isDropTarget = dropTargetId === node.id;

  return (
    <div
      className={`row ${isSelected ? 'selected' : ''} ${isDropTarget ? 'dropTarget' : ''}`}
      draggable
      onClick={(event) => onSelect(event, index, node.id)}
      onDoubleClick={() => node.kind === 'folder' && onNavigate(node.id)}
      onDragStart={() => onDragStart(node.id)}
      onDragOver={(event) => {
        if (node.kind === 'folder') {
          event.preventDefault();
          onDragOverFolder(node.id);
        }
      }}
      onDrop={() => node.kind === 'folder' && onDropOnFolder(node.id)}
    >
      <button
        className="name"
        style={{ paddingLeft: 12 + node.depth * 22 }}
        onClick={(event) => {
          if (node.kind === 'folder') {
            event.stopPropagation();
            onToggle(node.id);
          }
        }}
      >
        <span className={`icon ${node.kind}`}>{node.kind === 'folder' ? (expanded.has(node.id) ? '▾' : '▸') : '·'}</span>
        <strong>{highlight(node.name, query)}</strong>
      </button>
      <span>{categoryLabel[node.category]}</span>
      <span>{node.kind === 'folder' ? '-' : formatBytes(node.size)}</span>
      <span>{formatDate(node.modifiedAt)}</span>
    </div>
  );
}

function FileCard(props: Omit<RowProps, 'rows'> & { node: VisibleNode; index: number }) {
  const { node, selected, query, dropTargetId, onSelect, onDragStart, onDragOverFolder, onDropOnFolder } = props;
  return (
    <article
      className={`card ${selected.has(node.id) ? 'selected' : ''} ${dropTargetId === node.id ? 'dropTarget' : ''}`}
      draggable
      onClick={(event) => onSelect(event, props.index, node.id)}
      onDragStart={() => onDragStart(node.id)}
      onDragOver={(event) => {
        if (node.kind === 'folder') {
          event.preventDefault();
          onDragOverFolder(node.id);
        }
      }}
      onDrop={() => node.kind === 'folder' && onDropOnFolder(node.id)}
    >
      <span className={`tileIcon ${node.kind}`}>{node.kind === 'folder' ? '▣' : '□'}</span>
      <strong>{highlight(node.name, query)}</strong>
      <span>{categoryLabel[node.category]} · {node.kind === 'folder' ? 'folder' : formatBytes(node.size)}</span>
      <span>{formatDate(node.modifiedAt)}</span>
    </article>
  );
}

function hasMatchingDescendant(parentId: string, map: Map<string | null, FileNode[]>, matches: (node: FileNode) => boolean): boolean {
  for (const child of map.get(parentId) ?? []) {
    if (matches(child)) return true;
    if (child.kind === 'folder' && hasMatchingDescendant(child.id, map, matches)) return true;
  }
  return false;
}

function isDescendant(targetId: string, possibleAncestorId: string, nodeById: Map<string, FileNode>) {
  let current = nodeById.get(targetId);
  while (current?.parentId) {
    if (current.parentId === possibleAncestorId) return true;
    current = nodeById.get(current.parentId);
  }
  return false;
}

function highlight(text: string, query: string) {
  const normalized = query.trim();
  if (!normalized) return text;
  const index = text.toLowerCase().indexOf(normalized.toLowerCase());
  if (index < 0) return text;
  return (
    <>
      {text.slice(0, index)}
      <mark>{text.slice(index, index + normalized.length)}</mark>
      {text.slice(index + normalized.length)}
    </>
  );
}

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(1)} ${units[index]}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' }).format(new Date(value));
}
