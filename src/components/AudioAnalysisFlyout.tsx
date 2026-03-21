import React, { useState } from 'react';
import { X, Upload, Wand2, Loader2, Music } from 'lucide-react';
import { analyzeGlobalAudio, AudioSegment } from '../services/audioAnalysisService';
import { TimelineSegment } from '../timelineParser';

interface AudioAnalysisFlyoutProps {
  isOpen: boolean;
  onClose: () => void;
  onAnalysisComplete: (segments: TimelineSegment[]) => void;
}

export function AudioAnalysisFlyout({ isOpen, onClose, onAnalysisComplete }: AudioAnalysisFlyoutProps) {
  const [url, setUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [status, setStatus] = useState('');

  const handleAnalyze = async (audioUrl: string) => {
    if (!audioUrl) return;
    setIsAnalyzing(true);
    setStatus('Decoding audio and detecting segments...');
    
    try {
      const analyzed = await analyzeGlobalAudio(audioUrl, setStatus);
      
      setStatus(`Analyzed ${analyzed.length} segments. Generating timeline...`);
      
      const newSegments: TimelineSegment[] = analyzed.map((seg, i) => {
        // Map sentiment to patterns
        let patternType = 'fascinator';
        let pattern = 'flat spiral';
        let color = '#00ffcc';
        
        if (seg.sentiment === 'positive') {
          patternType = 'fascinator';
          pattern = 'mandala';
          color = '#ffcc00';
        } else if (seg.sentiment === 'negative') {
          patternType = 'topology';
          pattern = 'wave';
          color = '#ff3300';
        } else if (seg.sentiment === 'neutral') {
          patternType = 'repetition';
          pattern = 'rings';
          color = '#0088ff';
        }

        const textContent = `# Segment ${i + 1}\n${seg.text}`;
        return {
          id: `analyzed-${Date.now()}-${i}`,
          text: textContent,
          rawMarkdown: textContent,
          media: [],
          config: {
            duration: Math.max(2, seg.end - seg.start),
            patternType,
            pattern,
            patternColor1: color,
            camera: 'orbit',
            cameraSpeed: 0.5,
            binaural: 'focus',
            metronome: 0,
            audioUrl: audioUrl
          }
        };
      });

      onAnalysisComplete(newSegments);
      onClose();
    } catch (error) {
      console.error(error);
      setStatus('Error during analysis.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-950">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold">
            <Wand2 size={20} />
            <span>AI Audio Importer</span>
          </div>
          <button onClick={onClose} className="p-1 text-zinc-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-6">
          <div className="text-sm text-zinc-400">
            Import an audio or video file to automatically generate a synchronized visual timeline based on speech and sentiment.
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Media URL</label>
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="https://example.com/media.mp4"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-800"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-zinc-900 px-2 text-zinc-500">Or</span>
            </div>
          </div>

          <label className="flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-zinc-800 rounded-2xl hover:border-emerald-500/50 hover:bg-emerald-500/5 cursor-pointer transition-all group">
            <div className="p-3 bg-zinc-800 rounded-full group-hover:bg-emerald-500/20 group-hover:text-emerald-400 transition-colors">
              <Upload size={24} />
            </div>
            <div className="text-sm font-medium text-zinc-300">Choose local file</div>
            <input 
              type="file" 
              accept="audio/*,video/*" 
              className="hidden" 
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const localUrl = URL.createObjectURL(file);
                  handleAnalyze(localUrl);
                }
              }}
            />
          </label>

          {url && (
            <button 
              onClick={() => handleAnalyze(url)}
              disabled={isAnalyzing}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20"
            >
              {isAnalyzing ? <Loader2 size={18} className="animate-spin" /> : <Music size={18} />}
              {isAnalyzing ? 'Analyzing...' : 'Analyze URL'}
            </button>
          )}

          {isAnalyzing && (
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="text-xs text-emerald-400 animate-pulse font-medium">{status}</div>
              <div className="w-full bg-zinc-800 h-1 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full animate-progress-indefinite"></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
