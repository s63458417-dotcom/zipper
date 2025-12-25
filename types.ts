// File System Types
export interface FileSystemEntry {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  fullPath: string;
}

export interface FileSystemFileEntry extends FileSystemEntry {
  isFile: true;
  isDirectory: false;
  file: (callback: (file: File) => void, errorCallback?: (error: DOMException) => void) => void;
}

export interface FileSystemDirectoryEntry extends FileSystemEntry {
  isFile: false;
  isDirectory: true;
  createReader: () => FileSystemDirectoryReader;
}

export interface FileSystemDirectoryReader {
  readEntries: (
    successCallback: (entries: FileSystemEntry[]) => void,
    errorCallback?: (error: DOMException) => void
  ) => void;
}

// App Types

export interface ProcessedFile {
  file: File;
  path: string;
  selected: boolean;
  size: number;
}

export interface ZipSettings {
  password?: string;
  // 0 = Store, 5 = Deflate (Normal), 9 = Deflate (Best)
  compressionLevel: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9; 
  devMode: boolean; // Automates exclusion patterns
  exclusionPatterns: string[];
  addTimestamp: boolean;
  readmeContent: string;
}

export interface ZipStats {
  originalSize: number;
  compressedSize: number;
  startTime: number;
  endTime?: number;
}

export type ZipStatus = 'idle' | 'analyzing' | 'processing' | 'ready' | 'error';

// Tree Structure for Preview
export interface FileTreeNode {
  id: string;
  name: string;
  path: string; // Full relative path
  isDir: boolean;
  size: number;
  children?: FileTreeNode[];
  selected: boolean; // For checkbox
  indeterminate?: boolean; // For partial selection state
}