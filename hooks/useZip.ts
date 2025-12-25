import { useState, useCallback, useRef } from 'react';
import { BlobReader, BlobWriter, TextReader, ZipWriter } from '@zip.js/zip.js';
import saveAs from 'file-saver';
import { ProcessedFile, ZipStatus, ZipSettings, ZipStats } from '../types';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { playSound } from '../utils/soundUtils';

interface UseZipReturn {
  status: ZipStatus;
  progress: number;
  currentFile: string;
  fileName: string | null;
  setFileName: (name: string) => void;
  fileCount: number;
  zipBlob: Blob | null;
  stats: ZipStats | null;
  error: string | null;
  compressFiles: (files: ProcessedFile[], settings: ZipSettings, userFileName?: string) => Promise<void>;
  reset: () => void;
  downloadZip: () => void;
  abortCompression: () => void;
}

export const useZip = (): UseZipReturn => {
  const [status, setStatus] = useState<ZipStatus>('idle');
  const [progress, setProgress] = useState<number>(0);
  const [currentFile, setCurrentFile] = useState<string>('');
  const [zipBlob, setZipBlob] = useState<Blob | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileCount, setFileCount] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<ZipStats | null>(null);

  const zipWriterRef = useRef<ZipWriter<Blob> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    setStatus('idle');
    setProgress(0);
    setCurrentFile('');
    setZipBlob(null);
    setFileName(null);
    setFileCount(0);
    setError(null);
    setStats(null);
    zipWriterRef.current = null;
    abortControllerRef.current = null;
  }, []);

  const abortCompression = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setStatus('idle');
      toast.info('Compression aborted');
    }
  }, []);

  const compressFiles = useCallback(async (files: ProcessedFile[], settings: ZipSettings, userFileName?: string) => {
    // Filter out unselected files
    const activeFiles = files.filter(f => f.selected);

    if (activeFiles.length === 0) {
      toast.error("No files selected to compress.");
      return;
    }

    // Memory warning (approximate)
    const totalSize = activeFiles.reduce((acc, f) => acc + f.size, 0);
    if (totalSize > 1024 * 1024 * 1024) { // 1GB
       toast.warning('Large folder detected. This might take a while or run out of memory.');
    }

    try {
      setStatus('processing');
      playSound('start');
      setFileCount(activeFiles.length);
      setProgress(0);
      setZipBlob(null);

      // Initialize Stats
      const startTime = Date.now();
      const newStats: ZipStats = {
        originalSize: totalSize,
        compressedSize: 0,
        startTime
      };

      // Determine Filename
      let finalName = userFileName?.trim();
      
      if (!finalName) {
         let generatedName = "archive.zip";
         const firstPath = activeFiles[0].path;
         if (firstPath.includes('/')) {
           generatedName = `${firstPath.split('/')[0]}.zip`;
         }
         finalName = generatedName;
      }
      
      if (settings.addTimestamp) {
        const date = new Date().toISOString().split('T')[0];
        // Handle extension
        if (finalName.toLowerCase().endsWith('.zip')) {
            finalName = finalName.replace(/\.zip$/i, `_${date}.zip`);
        } else {
            finalName = `${finalName}_${date}.zip`;
        }
      }
      
      setFileName(finalName);
      
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;
      const password = settings.password?.trim();

      let finalBlob: Blob;

      // --- BRANCH STRATEGY ---
      if (password) {
        // STRATEGY: Encrypted Container (Nested Zip)
        // This creates an inner zip with all files, then puts that inner zip
        // into an outer zip which is encrypted. This hides filenames.
        
        // 1. Create Inner Zip (Content)
        const innerBlobWriter = new BlobWriter("application/zip");
        const innerZipWriter = new ZipWriter(innerBlobWriter, { bufferedWrite: true });
        zipWriterRef.current = innerZipWriter;

        // Add README to inner zip
        if (settings.readmeContent.trim()) {
          await innerZipWriter.add("README.txt", new TextReader(settings.readmeContent));
        }

        let processedCount = 0;
        for (const fileObj of activeFiles) {
           if (signal.aborted) throw new Error("Aborted");
           setCurrentFile(fileObj.path);
           
           await innerZipWriter.add(fileObj.path, new BlobReader(fileObj.file), {
             level: settings.compressionLevel
           });

           processedCount++;
           // Scale progress to 80% for the first pass
           setProgress((processedCount / activeFiles.length) * 85);
        }

        setCurrentFile('Encrypting Container...');
        const innerBlob = await innerZipWriter.close();
        if (signal.aborted) throw new Error("Aborted");

        // 2. Create Outer Zip (Container)
        const outerBlobWriter = new BlobWriter("application/zip");
        const outerZipWriter = new ZipWriter(outerBlobWriter, { bufferedWrite: true });
        zipWriterRef.current = outerZipWriter;

        const innerName = finalName.replace(/\.zip$/i, '') + '_content.zip';

        await outerZipWriter.add(innerName, new BlobReader(innerBlob), {
           password: password,
           zipCrypto: false, // Force AES-256 for strong encryption
           level: 0 // No need to compress an already compressed zip
        });

        setProgress(100);
        finalBlob = await outerZipWriter.close();

      } else {
        // STRATEGY: Standard Zip
        // Direct compression into the final zip file.
        const zipWriter = new ZipWriter(new BlobWriter("application/zip"), {
          bufferedWrite: true,
          keepOrder: false,
        });
        zipWriterRef.current = zipWriter;

        // Add README
        if (settings.readmeContent.trim()) {
          await zipWriter.add("README.txt", new TextReader(settings.readmeContent));
        }

        let processedCount = 0;
        for (const fileObj of activeFiles) {
          if (signal.aborted) throw new Error("Aborted");
          
          setCurrentFile(fileObj.path);
          
          await zipWriter.add(fileObj.path, new BlobReader(fileObj.file), {
            level: settings.compressionLevel
          });

          processedCount++;
          setProgress((processedCount / activeFiles.length) * 100);
        }

        setCurrentFile('Finalizing...');
        finalBlob = await zipWriter.close();
      }

      if (signal.aborted) return;

      setZipBlob(finalBlob);
      newStats.compressedSize = finalBlob.size;
      newStats.endTime = Date.now();
      setStats(newStats);
      
      setStatus('ready');
      playSound('success');
      toast.success(password ? 'Secure container created!' : 'Compression complete!');
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });

    } catch (err: any) {
      if (err.message === "Aborted") return;
      console.error(err);
      setError(err.message || "An unknown error occurred.");
      setStatus('error');
      toast.error('Compression failed');
    }
  }, []);

  const downloadZip = useCallback(() => {
    if (zipBlob && fileName) {
      const finalName = fileName.toLowerCase().endsWith('.zip') ? fileName : `${fileName}.zip`;
      saveAs(zipBlob, finalName);
    }
  }, [zipBlob, fileName]);

  return {
    status,
    progress,
    currentFile,
    fileName,
    setFileName,
    fileCount,
    zipBlob,
    stats,
    error,
    compressFiles,
    reset,
    downloadZip,
    abortCompression
  };
};