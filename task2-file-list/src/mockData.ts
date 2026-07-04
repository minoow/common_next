export type FileKind = 'folder' | 'file';
export type FileCategory = 'folder' | 'image' | 'document' | 'video' | 'archive' | 'code' | 'audio';

export type FileNode = {
  id: string;
  parentId: string | null;
  name: string;
  kind: FileKind;
  category: FileCategory;
  extension?: string;
  size: number;
  modifiedAt: string;
};

const samples: Array<{ category: Exclude<FileCategory, 'folder'>; extension: string; prefix: string; sizeBase: number }> = [
  { category: 'image', extension: 'png', prefix: 'visual', sizeBase: 2_400_000 },
  { category: 'document', extension: 'pdf', prefix: 'brief', sizeBase: 1_200_000 },
  { category: 'video', extension: 'mp4', prefix: 'clip', sizeBase: 42_000_000 },
  { category: 'archive', extension: 'zip', prefix: 'backup', sizeBase: 18_000_000 },
  { category: 'code', extension: 'tsx', prefix: 'module', sizeBase: 180_000 },
  { category: 'audio', extension: 'wav', prefix: 'sound', sizeBase: 9_000_000 }
];

export function createMockFileTree(): FileNode[] {
  const nodes: FileNode[] = [];
  const bulkId = 'folder-bulk';

  nodes.push(folder('folder-bulk', null, 'Bulk Workspace', 0));
  nodes.push(folder('folder-products', null, 'Product Archives', 1));
  nodes.push(folder('folder-design', null, 'Design Library', 2));
  nodes.push(folder('folder-media', null, 'Media Vault', 3));

  for (let i = 0; i < 10_000; i += 1) {
    nodes.push(file(`${bulkId}-file-${i}`, bulkId, i, `bulk-${String(i + 1).padStart(5, '0')}`));
  }

  const roots = ['folder-products', 'folder-design', 'folder-media'];
  let sequence = 10_000;
  for (const rootId of roots) {
    for (let depth1 = 0; depth1 < 8; depth1 += 1) {
      const level1 = `${rootId}-team-${depth1}`;
      nodes.push(folder(level1, rootId, `Team ${depth1 + 1}`, sequence++));

      for (let depth2 = 0; depth2 < 6; depth2 += 1) {
        const level2 = `${level1}-project-${depth2}`;
        nodes.push(folder(level2, level1, `Project ${depth1 + 1}-${depth2 + 1}`, sequence++));

        for (let depth3 = 0; depth3 < 3; depth3 += 1) {
          const level3 = `${level2}-phase-${depth3}`;
          nodes.push(folder(level3, level2, `Phase ${depth3 + 1}`, sequence++));

          for (let fileIndex = 0; fileIndex < 18; fileIndex += 1) {
            nodes.push(file(`${level3}-file-${fileIndex}`, level3, sequence, `asset-${depth1 + 1}-${depth2 + 1}-${depth3 + 1}-${fileIndex + 1}`));
            sequence += 1;
          }
        }
      }
    }
  }

  return nodes;
}

function folder(id: string, parentId: string | null, name: string, offset: number): FileNode {
  return {
    id,
    parentId,
    name,
    kind: 'folder',
    category: 'folder',
    size: 0,
    modifiedAt: new Date(Date.now() - offset * 3_600_000).toISOString()
  };
}

function file(id: string, parentId: string, index: number, basename: string): FileNode {
  const sample = samples[index % samples.length];
  return {
    id,
    parentId,
    name: `${sample.prefix}-${basename}.${sample.extension}`,
    kind: 'file',
    category: sample.category,
    extension: sample.extension,
    size: sample.sizeBase + ((index + 17) * 104_729) % 850_000_000,
    modifiedAt: new Date(Date.now() - index * 1_800_000).toISOString()
  };
}
