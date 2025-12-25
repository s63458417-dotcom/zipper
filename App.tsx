import React from 'react';
import { FolderUploader } from './components/FolderUploader';
import { Layers, Send } from 'lucide-react';
import { Toaster } from 'sonner';
import { motion } from 'framer-motion';
import { useSecurity } from './hooks/useSecurity';

// --- Aurora Background Component ---
// Optimized: Replaced CSS filter: blur() with radial-gradients for better performance on low-end devices.
const AuroraBackground = () => {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden bg-black pointer-events-none">
      {/* Noise Texture */}
      <div className="bg-noise absolute inset-0 z-20" />
      
      {/* Aurora Blob 1 (Purple) */}
      <motion.div 
        animate={{ 
          x: [-50, 50, -50], 
          y: [-20, 20, -20], 
          scale: [1, 1.1, 1],
          opacity: [0.3, 0.5, 0.3]
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "linear" }} // Linear ease is cheaper
        style={{
          background: 'radial-gradient(circle, rgba(88,28,135,0.4) 0%, rgba(0,0,0,0) 70%)',
          willChange: 'transform, opacity'
        }}
        className="absolute -top-[10%] -left-[10%] w-[80vw] h-[80vw] rounded-full mix-blend-screen opacity-30"
      />
      
      {/* Aurora Blob 2 (Cyan) */}
      <motion.div 
        animate={{ 
          x: [50, -50, 50], 
          y: [20, -20, 20],
          scale: [1.1, 1, 1.1],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        style={{
          background: 'radial-gradient(circle, rgba(8,145,178,0.3) 0%, rgba(0,0,0,0) 70%)',
          willChange: 'transform'
        }}
        className="absolute top-[10%] -right-[10%] w-[70vw] h-[70vw] rounded-full mix-blend-screen opacity-30"
      />

      {/* Aurora Blob 3 (Blue) */}
      <motion.div 
        animate={{ 
           scale: [1, 1.2, 1],
           opacity: [0.2, 0.4, 0.2]
        }}
        transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
        style={{
          background: 'radial-gradient(circle, rgba(30,58,138,0.3) 0%, rgba(0,0,0,0) 70%)',
          willChange: 'transform, opacity'
        }}
        className="absolute bottom-[-10%] left-[20%] w-[60vw] h-[60vw] rounded-full mix-blend-screen opacity-20"
      />
    </div>
  );
};

function App() {
  // Activate Security Protocols (Disable Context Menu, F12, etc.)
  useSecurity();

  return (
    <div className="min-h-screen relative text-white selection:bg-cyan-500/30">
      <AuroraBackground />
      <Toaster position="top-center" theme="dark" toastOptions={{
        style: { background: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }
      }} />

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Navbar */}
        <header className="px-6 py-8 flex items-center justify-between max-w-7xl mx-auto w-full">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3"
          >
            <div className="bg-white/10 p-2 rounded-xl backdrop-blur-md border border-white/5">
              <Layers size={20} className="text-cyan-400" />
            </div>
            <span className="font-light text-xl tracking-tight">
              Zip<span className="font-semibold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500">Stream</span>
            </span>
          </motion.div>
          
          <motion.a 
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             href="https://t.me/FrostxSanTan"
             target="_blank"
             rel="noopener noreferrer"
             className="text-slate-500 hover:text-white transition-colors"
          >
             <Send size={20} />
          </motion.a>
        </header>

        {/* Main Content */}
        <main className="flex-1 flex flex-col items-center justify-center px-4 pb-20">
          <div className="text-center mb-12 space-y-4">
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-5xl md:text-7xl font-bold tracking-tighter"
            >
              <span className="bg-clip-text text-transparent bg-gradient-to-b from-white via-white to-slate-500">
                Encrypted. Local. Instant.
              </span>
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-lg text-slate-400 max-w-2xl mx-auto font-light"
            >
              The next generation of browser-based compression. <br className="hidden md:inline"/>
              Drag, drop, and secure your files without them ever leaving your device.
            </motion.p>
          </div>

          <FolderUploader />

        </main>

        <footer className="py-6 text-center text-xs text-slate-600 font-mono uppercase tracking-widest opacity-50">
           Created by BT4 • Lonely Coder
        </footer>
      </div>
    </div>
  );
}

export default App;