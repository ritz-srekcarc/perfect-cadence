import React, { useEffect, useRef, useState } from 'react';
import { Play, Square, Edit3, Eye, Settings, Share2, HelpCircle, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/components/prism-markdown';
import 'prismjs/themes/prism-tomorrow.css';
import { SceneManager } from './SceneManager';
import { audioEngine } from './audioEngine';
import { DEFAULT_MARKDOWN, parseTimeline, serializeTimeline, TimelineSegment } from './timelineParser';
import { VisualEditor } from './components/VisualEditor';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneManagerRef = useRef<SceneManager | null>(null);
  
  const [markdown, setMarkdown] = useState(DEFAULT_MARKDOWN);
  const [segments, setSegments] = useState<TimelineSegment[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [mode, setMode] = useState<'edit' | 'view'>('edit');
  const [activeTab, setActiveTab] = useState<'markdown' | 'visual'>('visual');
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [copied, setCopied] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get('m');
    let initialMarkdown = DEFAULT_MARKDOWN;
    
    if (encoded) {
      try {
        initialMarkdown = decodeURIComponent(atob(encoded).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
      } catch (e) {
        console.error("Failed to parse markdown from URL", e);
      }
    }

    const audioUrl = params.get('audioUrl');
    if (audioUrl) {
      const parsed = parseTimeline(initialMarkdown);
      if (parsed.length > 0) {
        parsed[0].config.audioUrl = audioUrl;
        initialMarkdown = serializeTimeline(parsed);
      }
    }

    setMarkdown(initialMarkdown);
  }, []);

  const handleShare = () => {
    try {
      const encoded = btoa(encodeURIComponent(markdown).replace(/%([0-9A-F]{2})/g,
          function toSolidBytes(match, p1) {
              return String.fromCharCode(parseInt(p1, 16));
      }));
      const url = new URL(window.location.href);
      url.searchParams.set('m', encoded);
      window.history.replaceState({}, '', url.toString());
      navigator.clipboard.writeText(url.toString());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("Failed to encode markdown", e);
    }
  };

  const totalDuration = segments.reduce((acc, seg) => acc + seg.config.duration, 0);
  const totalElapsed = segments.slice(0, currentSegmentIndex).reduce((acc, seg) => acc + seg.config.duration, 0) + timeElapsed;

  const handleScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPlaying || segments.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const targetTime = percentage * totalDuration;

    let accumulatedTime = 0;
    for (let i = 0; i < segments.length; i++) {
      const segDuration = segments[i].config.duration;
      if (accumulatedTime + segDuration > targetTime || i === segments.length - 1) {
        setCurrentSegmentIndex(i);
        setTimeElapsed(targetTime - accumulatedTime);
        break;
      }
      accumulatedTime += segDuration;
    }
  };

  useEffect(() => {
    if (canvasRef.current && !sceneManagerRef.current) {
      sceneManagerRef.current = new SceneManager(canvasRef.current);
    }
    return () => {
      if (sceneManagerRef.current) {
        sceneManagerRef.current.dispose();
        sceneManagerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    setSegments(parseTimeline(markdown));
  }, [markdown]);

  // Handle segment transitions
  useEffect(() => {
    if (isPlaying && segments.length > 0) {
      const currentSegment = segments[currentSegmentIndex];
      if (timeElapsed >= currentSegment.config.duration) {
        if (currentSegmentIndex < segments.length - 1) {
          setCurrentSegmentIndex(idx => idx + 1);
          setTimeElapsed(0);
        } else {
          setIsPlaying(false);
          audioEngine.stopAll();
          setTimeElapsed(0);
        }
      }
    }
  }, [timeElapsed, isPlaying, currentSegmentIndex, segments]);

  useEffect(() => {
    let interval: number | undefined;
    if (isPlaying && segments.length > 0) {
      audioEngine.resume();
      
      const currentSegment = segments[currentSegmentIndex];
      
      // Apply scene config
      if (sceneManagerRef.current) {
        sceneManagerRef.current.applyConfig(currentSegment.config);
        sceneManagerRef.current.updateText(currentSegment.text);
      }

      // Apply audio config
      audioEngine.playBinaural(
        currentSegment.config.binaural, 
        currentSegment.config.carrierFreq, 
        currentSegment.config.beatFreq, 
        currentSegment.config.ampModulation
      );
      audioEngine.playMetronome(currentSegment.config.metronome);
      
      if (currentSegment.config.audioUrl) {
        audioEngine.playCustomAudio(currentSegment.config.audioUrl);
      } else {
        audioEngine.stopCustomAudio();
      }

      interval = window.setInterval(() => {
        setTimeElapsed(prev => prev + 1);
      }, 1000);
    } else {
      audioEngine.stopAll();
    }

    return () => {
      if (interval !== undefined) clearInterval(interval);
    };
  }, [isPlaying, currentSegmentIndex, segments]);

  const handlePlay = () => {
    if (segments.length === 0) return;
    setCurrentSegmentIndex(0);
    setTimeElapsed(0);
    setIsPlaying(true);
    setMode('view');
  };

  const handleStop = () => {
    setIsPlaying(false);
    audioEngine.stopAll();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('audio/')) {
      const url = URL.createObjectURL(file);
      const newSegments = parseTimeline(markdown);
      if (newSegments.length > 0) {
        newSegments[0].config.audioUrl = url;
        setMarkdown(serializeTimeline(newSegments));
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <div 
      className="flex h-screen w-full bg-zinc-950 text-zinc-100 font-sans overflow-hidden"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      {/* Sidebar / Editor */}
      <div className={`flex flex-col border-r border-zinc-800 bg-zinc-900 transition-all duration-300 ${mode === 'edit' ? 'w-1/2' : 'w-0 opacity-0 overflow-hidden'}`}>
        <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-950">
          <h1 className="text-xl font-semibold tracking-tight text-emerald-400">Perfect Cadence</h1>
          <div className="flex gap-2">
            <button 
              onClick={() => setIsHelpOpen(true)}
              className="p-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              title="Help & Syntax"
            >
              <HelpCircle size={16} />
            </button>
            <button 
              onClick={handleShare}
              className="p-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
            >
              <Share2 size={16} /> {copied ? 'Copied!' : 'Share'}
            </button>
            <button 
              onClick={isPlaying ? handleStop : handlePlay}
              className={`p-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors ${isPlaying ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'}`}
            >
              {isPlaying ? <><Square size={16} /> Stop</> : <><Play size={16} /> Play</>}
            </button>
          </div>
        </div>
        
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex border-b border-zinc-800 bg-zinc-900">
            <button 
              onClick={() => setActiveTab('visual')}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'visual' ? 'text-emerald-400 border-b-2 border-emerald-400 bg-zinc-800/50' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/30'}`}
            >
              Visual Editor
            </button>
            <button 
              onClick={() => setActiveTab('markdown')}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'markdown' ? 'text-emerald-400 border-b-2 border-emerald-400 bg-zinc-800/50' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/30'}`}
            >
              Markdown
            </button>
          </div>
          
          <div className="flex-1 overflow-auto relative">
            {activeTab === 'markdown' ? (
              <div className="absolute inset-0 p-4">
                <div className="w-full h-full bg-zinc-950 border border-zinc-800 rounded-xl overflow-auto text-sm font-mono text-zinc-300 focus-within:ring-2 focus-within:ring-emerald-500/50">
                  <Editor
                    value={markdown}
                    onValueChange={code => setMarkdown(code)}
                    highlight={code => Prism.highlight(code, Prism.languages.markdown, 'markdown')}
                    padding={16}
                    style={{
                      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                      fontSize: 14,
                      minHeight: '100%'
                    }}
                    textareaClassName="focus:outline-none"
                  />
                </div>
              </div>
            ) : (
              <div className="absolute inset-0 overflow-auto">
                <VisualEditor 
                  segments={segments} 
                  onChange={(newSegments) => {
                    setSegments(newSegments);
                    setMarkdown(serializeTimeline(newSegments));
                  }} 
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Viewport */}
      <div className="flex-1 relative flex flex-col">
        {/* Top Bar for View Mode */}
        {mode === 'view' && (
          <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-20 bg-gradient-to-b from-black/80 to-transparent">
            <h1 className="text-xl font-semibold tracking-tight text-emerald-400 drop-shadow-md">Perfect Cadence</h1>
            <div className="flex gap-2">
              <button 
                onClick={() => setIsHelpOpen(true)}
                className="p-2 rounded-lg bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700 backdrop-blur-sm transition-colors flex items-center gap-2 text-sm"
                title="Help & Syntax"
              >
                <HelpCircle size={16} />
              </button>
              <button 
                onClick={() => setMode('edit')}
                className="p-2 rounded-lg bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700 backdrop-blur-sm transition-colors flex items-center gap-2 text-sm"
              >
                <Edit3 size={16} /> Edit Timeline
              </button>
              <button 
                onClick={isPlaying ? handleStop : handlePlay}
                className={`p-2 rounded-lg flex items-center gap-2 text-sm font-medium backdrop-blur-sm transition-colors ${isPlaying ? 'bg-red-500/80 text-white hover:bg-red-600' : 'bg-emerald-500/80 text-white hover:bg-emerald-600'}`}
              >
                {isPlaying ? <><Square size={16} /> Stop</> : <><Play size={16} /> Play</>}
              </button>
            </div>
          </div>
        )}

        {/* 3D Canvas */}
        <canvas 
          ref={canvasRef} 
          className="w-full h-full outline-none touch-none absolute inset-0 z-0"
        />

        {/* Markdown Text Overlay */}
        {isPlaying && segments.length > 0 && (
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none p-12">
            <div className="text-center max-w-3xl drop-shadow-2xl">
              <div className="prose prose-invert prose-emerald prose-h1:text-5xl prose-h1:font-light prose-h1:tracking-tight prose-p:text-2xl prose-p:font-light prose-p:leading-relaxed opacity-90">
                <ReactMarkdown>{segments[currentSegmentIndex].text}</ReactMarkdown>
              </div>
            </div>
          </div>
        )}

        {/* Playback Progress Overlay */}
        {isPlaying && segments.length > 0 && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-md px-4 z-20">
            <div className="bg-zinc-900/80 backdrop-blur-md border border-zinc-800 rounded-2xl p-4 shadow-2xl">
              <div className="flex justify-between text-xs text-zinc-400 mb-2 font-mono">
                <span>Segment {currentSegmentIndex + 1} / {segments.length}</span>
                <span>{Math.floor(totalElapsed)}s / {Math.floor(totalDuration)}s</span>
              </div>
              <div 
                className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden cursor-pointer relative"
                onClick={handleScrub}
              >
                <div 
                  className="h-full bg-emerald-500 transition-all duration-100 ease-linear"
                  style={{ width: `${(totalElapsed / totalDuration) * 100}%` }}
                />
              </div>
              <div className="mt-3 text-center text-sm font-medium text-zinc-300">
                Pattern: <span className="text-emerald-400">{segments[currentSegmentIndex].config.pattern}</span> | 
                Audio: <span className="text-emerald-400">{segments[currentSegmentIndex].config.binaural}</span>
              </div>
            </div>
          </div>
        )}

        {/* Help Pane */}
        <div className={`absolute top-0 right-0 h-full w-80 bg-zinc-900 border-l border-zinc-800 shadow-2xl z-50 transform transition-transform duration-300 flex flex-col ${isHelpOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-950">
            <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2"><HelpCircle size={18} className="text-emerald-400"/> Syntax & Options</h2>
            <button onClick={() => setIsHelpOpen(false)} className="text-zinc-400 hover:text-white transition-colors p-1 rounded-md hover:bg-zinc-800">
              <X size={20} />
            </button>
          </div>
          <div className="p-6 overflow-y-auto flex-1 prose prose-invert prose-sm prose-emerald max-w-none">
            <h3 className="text-zinc-100 mt-0">Timeline Syntax</h3>
            <p className="text-zinc-400">Separate segments with <code>---</code>.</p>
            <p className="text-zinc-400">Configure a segment using a <code>```config</code> block. If omitted, it inherits the previous segment's config.</p>
            <pre className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs"><code>{`\`\`\`config
duration: 10
pattern: spiral
camera: static
binaural: focus
metronome: 60
\`\`\``}</code></pre>
            
            <h3 className="text-zinc-100">Options</h3>
            <ul className="text-zinc-400 space-y-2">
              <li><strong className="text-zinc-200">duration:</strong> Seconds (number)</li>
              <li><strong className="text-zinc-200">pattern:</strong> <code>spiral</code>, <code>tunnel</code>, <code>rings</code>, <code>particles</code>, <code>mandala</code>, <code>kaleidoscope</code>, <code>waves</code>, <code>pulse</code></li>
              <li><strong className="text-zinc-200">patternType:</strong> <code>default</code>, <code>double</code>, <code>galaxy</code>, <code>sphere</code>, <code>cylinder</code>, <code>hypnotic</code>, <code>breathing</code>, <code>infinite</code>, <code>vortex</code>, <code>sacred_geometry</code></li>
              <li><strong className="text-zinc-200">patternSpeed:</strong> Animation speed multiplier (number)</li>
              <li><strong className="text-zinc-200">patternScale:</strong> Pattern size multiplier (number)</li>
              <li><strong className="text-zinc-200">patternComplexity:</strong> Detail level (number)</li>
              <li><strong className="text-zinc-200">patternColor1/2:</strong> Hex colors (string, e.g., #ff0000)</li>
              <li><strong className="text-zinc-200">camera:</strong> <code>static</code>, <code>orbit</code>, <code>fly</code>, <code>pan</code></li>
              <li><strong className="text-zinc-200">cameraSpeed:</strong> Multiplier (number)</li>
              <li><strong className="text-zinc-200">cameraRadius:</strong> Distance from target (number)</li>
              <li><strong className="text-zinc-200">cameraHeight:</strong> Beta angle in radians (number)</li>
              <li><strong className="text-zinc-200">cameraTargetX/Y/Z:</strong> Target coordinates (number)</li>
              <li><strong className="text-zinc-200">cameraFov:</strong> Field of view in degrees (number)</li>
              <li><strong className="text-zinc-200">textFont:</strong> <code>sans-serif</code>, <code>serif</code>, <code>monospace</code>, <code>cursive</code>, <code>fantasy</code></li>
              <li><strong className="text-zinc-200">textDistance:</strong> Distance from camera (number, default 10)</li>
              <li><strong className="text-zinc-200">textSize:</strong> Font size (number, default 100)</li>
              <li><strong className="text-zinc-200">textOutline:</strong> <code>rainbow</code>, <code>none</code>, or hex color</li>
              <li><strong className="text-zinc-200">textShading:</strong> Enable drop shadow (true/false)</li>
              <li><strong className="text-zinc-200">textBackdrop:</strong> Enable dark background (true/false)</li>
              <li><strong className="text-zinc-200">textAnimType:</strong> <code>none</code>, <code>zoom</code>, <code>fade</code>, <code>float</code>, <code>warp</code>, <code>prism</code>, <code>glitch</code></li>
              <li><strong className="text-zinc-200">textAnimSpeed:</strong> Animation speed multiplier (number)</li>
              <li><strong className="text-zinc-200">textAnimIntensity:</strong> Animation strength multiplier (number)</li>
              <li><strong className="text-zinc-200">binaural:</strong> <code>focus</code>, <code>relax</code>, <code>sleep</code>, <code>custom</code>, <code>off</code></li>
              <li><strong className="text-zinc-200">metronome:</strong> BPM (number, 0 for off)</li>
              <li><strong className="text-zinc-200">carrierFreq:</strong> Hz (number, for custom binaural)</li>
              <li><strong className="text-zinc-200">beatFreq:</strong> Hz (number, for custom binaural)</li>
              <li><strong className="text-zinc-200">ampModulation:</strong> Hz (number, optional)</li>
              <li><strong className="text-zinc-200">audioUrl:</strong> URL to custom audio file (string). You can also drag and drop an audio file onto the window.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

