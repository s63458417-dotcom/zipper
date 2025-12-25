import { ProcessedFile, FileSystemEntry, FileSystemDirectoryEntry, FileSystemFileEntry, FileTreeNode } from '../types';

export const DEV_EXCLUSIONS = ['node_modules', '.git', '.DS_Store', '.env', 'dist', 'build', '.vscode'];

// Helper to check exclusions
const isExcluded = (path: string, patterns: string[]): boolean => {
  return patterns.some(pattern => {
    // Check if any part of the path matches the pattern strictly for directories
    // or if the filename contains the pattern
    const parts = path.split('/');
    return parts.some(part => part === pattern || part.includes(pattern));
  });
};

/**
 * Traverses a FileSystemEntry recursively and builds a flat list + optional stats.
 */
export const traverseFileTree = async (
  entry: FileSystemEntry, 
  path: string = '', 
  exclusionPatterns: string[] = []
): Promise<ProcessedFile[]> => {
  
  if (isExcluded(entry.name, exclusionPatterns)) return [];

  if (entry.isFile) {
    const fileEntry = entry as FileSystemFileEntry;
    return new Promise((resolve, reject) => {
      fileEntry.file(
        (file) => {
          if (isExcluded(file.name, exclusionPatterns)) {
            resolve([]);
            return;
          }
          const cleanPath = path + file.name;
          resolve([{ file, path: cleanPath, selected: true, size: file.size }]);
        },
        (err) => reject(err)
      );
    });
  } else if (entry.isDirectory) {
    const dirEntry = entry as FileSystemDirectoryEntry;
    const dirReader = dirEntry.createReader();
    
    const entries = await new Promise<FileSystemEntry[]>((resolve, reject) => {
      // Loop to read all entries (Chrome API limitation workaround)
      const allEntries: FileSystemEntry[] = [];
      const read = () => {
        dirReader.readEntries((results) => {
          if (results.length > 0) {
            allEntries.push(...results);
            read();
          } else {
            resolve(allEntries);
          }
        }, reject);
      };
      read();
    });

    const promises = entries.map((childEntry) => 
      traverseFileTree(childEntry, path + entry.name + '/', exclusionPatterns)
    );

    const results = await Promise.all(promises);
    return results.flat();
  }
  return [];
};

export const buildFileTree = (files: ProcessedFile[]): FileTreeNode[] => {
  const root: FileTreeNode[] = [];
  const map: Record<string, FileTreeNode> = {};

  files.forEach(f => {
    const parts = f.path.split('/');
    let currentPath = '';

    parts.forEach((part, index) => {
      const isFile = index === parts.length - 1;
      const parentPath = currentPath;
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      if (!map[currentPath]) {
        const node: FileTreeNode = {
          id: currentPath,
          name: part,
          path: currentPath,
          isDir: !isFile,
          size: isFile ? f.size : 0,
          children: isFile ? undefined : [],
          // Initialize selection based on file state; directories will be recalculated
          selected: isFile ? f.selected : true,
          indeterminate: false
        };
        map[currentPath] = node;

        if (index === 0) {
          root.push(node);
        } else {
          const parent = map[parentPath];
          if (parent && parent.children) {
            parent.children.push(node);
          }
        }
      } else if (isFile) {
         map[currentPath].size = f.size;
         map[currentPath].selected = f.selected;
      }
    });
  });

  // Recursively calculate size and selection state for directories
  const calcStats = (nodes: FileTreeNode[]) => {
    nodes.forEach(node => {
      if (node.children) {
        calcStats(node.children);
        node.size = node.children.reduce((acc, child) => acc + child.size, 0);
        
        // Selection Logic:
        // 1. All selected = directory selected
        // 2. Some selected or some indeterminate = directory indeterminate
        if (node.children.length > 0) {
            const allSelected = node.children.every(child => child.selected);
            const anyActive = node.children.some(child => child.selected || child.indeterminate);
            
            node.selected = allSelected;
            node.indeterminate = !allSelected && anyActive;
        }
      }
    });
  };
  calcStats(root);

  return root;
};

export const formatBytes = (bytes: number, decimals = 1) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

export const getFilesFromDataTransferItems = async (items: DataTransferItemList, exclusions: string[]): Promise<ProcessedFile[]> => {
  const filePromises: Promise<ProcessedFile[]>[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind === 'file') {
      const entry = item.webkitGetAsEntry?.() || (item as any).getAsEntry?.();
      if (entry) {
        filePromises.push(traverseFileTree(entry as FileSystemEntry, '', exclusions));
      } else {
        const file = item.getAsFile();
        if (file) {
          if (!isExcluded(file.name, exclusions)) {
             filePromises.push(Promise.resolve([{ file, path: file.name, selected: true, size: file.size }]));
          }
        }
      }
    }
  }

  const resultArrays = await Promise.all(filePromises);
  return resultArrays.flat();
};