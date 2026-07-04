export type FileNode = {
  id: string;
  parentId: string | null;
  name: string;
  type: 'folder' | 'file';
  size: number;
  updatedAt: string;
};

const originalFetch = window.fetch.bind(window);
const extensions = ['pdf', 'mov', 'zip', 'tsx', 'png', 'csv', 'pptx', 'mp4'];

function createFiles(): FileNode[] {
  const nodes: FileNode[] = [];

  for (let folderIndex = 0; folderIndex < 60; folderIndex += 1) {
    const folderId = `folder-${folderIndex}`;
    nodes.push({
      id: folderId,
      parentId: null,
      name: `Project ${String(folderIndex + 1).padStart(2, '0')}`,
      type: 'folder',
      size: 0,
      updatedAt: new Date(Date.now() - folderIndex * 86400000).toISOString()
    });

    for (let fileIndex = 0; fileIndex < 86; fileIndex += 1) {
      const ext = extensions[(folderIndex + fileIndex) % extensions.length];
      nodes.push({
        id: `${folderId}-file-${fileIndex}`,
        parentId: folderId,
        name: `asset-${folderIndex + 1}-${String(fileIndex + 1).padStart(3, '0')}.${ext}`,
        type: 'file',
        size: 200000 + ((folderIndex + 3) * (fileIndex + 11) * 7919) % 900000000,
        updatedAt: new Date(Date.now() - (folderIndex * 86 + fileIndex) * 3900000).toISOString()
      });
    }
  }

  return nodes;
}

const files = createFiles();

export function installMockApi() {
  window.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);

    if (url.endsWith('/api/files') && (!init?.method || init.method === 'GET')) {
      await new Promise((resolve) => window.setTimeout(resolve, 260));
      return Response.json({ files });
    }

    return originalFetch(input, init);
  };
}
