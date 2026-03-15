import React, { useEffect, useRef, useState } from 'react';
import { Play, Square, Edit3, Eye, Settings, Share2, HelpCircle, X, Ear, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/components/prism-markdown';
import 'prismjs/themes/prism-tomorrow.css';
import { SceneManager } from './SceneManager';
import { audioEngine } from './audioEngine';
import { DEFAULT_MARKDOWN, parseTimeline, serializeTimeline, TimelineSegment } from './timelineParser';
import { DEMO_MARKDOWN } from './demoPreset';
import { VisualEditor } from './components/VisualEditor';
import { AudioAnalysisFlyout } from './components/AudioAnalysisFlyout';
import { ShareFlyout } from './components/ShareFlyout';
import { SeizureWarning } from './components/SeizureWarning';
import { Wand2 } from 'lucide-react';
import LZString from 'lz-string';
import Joyride, { Step, CallBackProps, STATUS } from 'react-joyride';
import CryptoJS from 'crypto-js';
import { Lock, Unlock, AlertCircle } from 'lucide-react';

const SpiralLogo = ({ size = 20, className = "" }: { size?: number, className?: string }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 100 100" 
    className={`text-emerald-400 animate-[spin_10s_linear_infinite] ${className}`}
  >
    <path 
      d="M50 50c0-5.5 4.5-10 10-10s10 4.5 10 10-4.5 10-10 10-10-4.5-10-10zm-15 0c0-13.8 11.2-25 25-25s25 11.2 25 25-11.2 25-25 25-25-11.2-25-25zm-15 0c0-22.1 17.9-40 40-40s40 17.9 40 40-17.9 40-40 40-40-17.9-40-40z" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="4" 
    />
    <circle cx="50" cy="50" r="5" fill="currentColor" />
  </svg>
);

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneManagerRef = useRef<SceneManager | null>(null);
  
  const [markdown, setMarkdown] = useState(DEFAULT_MARKDOWN);
  const [segments, setSegments] = useState<TimelineSegment[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [mode, setMode] = useState<'edit' | 'view'>('view');
  const [activeTab, setActiveTab] = useState<'markdown' | 'visual'>('visual');
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [copied, setCopied] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isAnalysisOpen, setIsAnalysisOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [isFirstVisit, setIsFirstVisit] = useState(false);
  const [runTutorial, setRunTutorial] = useState(false);
  const [encryptedPayload, setEncryptedPayload] = useState<string | null>(null);
  const [decryptionPassword, setDecryptionPassword] = useState('');
  const [decryptionError, setDecryptionError] = useState('');
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(400);
  const [isDragging, setIsDragging] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    setSidebarWidth(Math.max(200, Math.min(800, e.clientX)));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  const tutorialSteps: Step[] = [
    {
      target: '.tutorial-play-btn',
      content: 'Click here to play or pause the timeline.',
      disableBeacon: true,
      placement: 'bottom',
    },
    {
      target: '.tutorial-tabs',
      content: 'Switch between the visual editor and the raw markdown code.',
      placement: 'bottom',
    },
    {
      target: '.tutorial-magic-btn',
      content: 'Use AI to generate a timeline from an audio file.',
      placement: 'right',
    },
    {
      target: '.tutorial-share-btn',
      content: 'Share your creation with others.',
      placement: 'bottom',
    },
    {
      target: 'canvas',
      content: 'The primary text layer is fixed to the pattern center in world space, while the blockquote (aux) layer is locked to your camera.',
      placement: 'center'
    }
  ];

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
      setRunTutorial(false);
    }
  };

  useEffect(() => {
    const hasSeenWarning = localStorage.getItem('hasSeenSeizureWarning');
    if (!hasSeenWarning) {
      setIsFirstVisit(true);
      setShowWarning(true);
    }
  }, []);

  const handleCloseWarning = (dontShowAgain: boolean) => {
    if (dontShowAgain) {
      localStorage.setItem('hasSeenSeizureWarning', 'true');
    }
    setShowWarning(false);
    
    const params = new URLSearchParams(window.location.search);
    const m = params.get('m');
    const encodedDemo = LZString.compressToEncodedURIComponent(DEMO_MARKDOWN);
    const shouldBypass = m && m !== encodedDemo;

    if (isFirstVisit && !shouldBypass) {
      setMarkdown(DEMO_MARKDOWN);
      setMode('edit');
      // Add a small delay to allow the sidebar transition to complete
      setTimeout(() => {
        setRunTutorial(true);
      }, 400);
    }
  };

  const encodeMarkdown = (md: string) => {
    try {
      return LZString.compressToEncodedURIComponent(md);
    } catch (e) {
      console.error("Failed to encode markdown", e);
      return "";
    }
  };

  const decodeMarkdown = (encoded: string) => {
    try {
      const decoded = LZString.decompressFromEncodedURIComponent(encoded);
      if (decoded !== null) return decoded;
      
      // Fallback for legacy base64
      try {
        return decodeURIComponent(atob(encoded).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
      } catch (e) {
        return null;
      }
    } catch (e) {
      console.error("Failed to decode markdown", e);
      return null;
    }
  };

  const DEMOS = {
    DEFAULT: DEFAULT_MARKDOWN,
    DEMO: DEMO_MARKDOWN,
    FOCUS: "# Deep Focus\nFocus your mind on the center.\n\n```config\nduration: 30\npattern: spiral\npatternType: hypnotic\npatternSpeed: 0.5\npatternColor1: #000000\npatternColor2: #00ff88\ncameraRadius: 30\ntextSize: 20\ntextDistance: 25\nbinaural: focus\nmetronome: 0\n```",
    COSMOS: "# Cosmic Journey\nDrifting through the stars.\n\n```config\nduration: 45\npattern: particles\npatternType: galaxy\npatternSpeed: 0.2\ncamera: orbit\ncameraSpeed: 0.1\ncameraRadius: 30\ntextSize: 20\ntextDistance: 25\nbinaural: sleep\n```",
    GEOMETRY: "# Sacred Geometry\nThe patterns of the universe.\n\n```config\nduration: 40\npattern: mandala\npatternType: sacred_geometry\npatternComplexity: 10\npatternColor1: #ff00ff\npatternColor2: #00ffff\ncameraRadius: 30\ntextSize: 20\ntextDistance: 25\nbinaural: relax\n```",
    ENERGY: "# Energy Pulse\nFeel the rhythm.\n\n```config\nduration: 20\npattern: pulse\npatternType: vortex\npatternSpeed: 2.0\nmetronome: 120\ncameraRadius: 30\ntextSize: 20\ntextDistance: 25\nbinaural: focus\n```"
  };

  // Pre-calculate encoded demos for highlighting and links
  const encodedDemos = React.useMemo(() => ({
    DEFAULT: encodeMarkdown(DEMOS.DEFAULT),
    DEMO: encodeMarkdown(DEMOS.DEMO),
    FOCUS: encodeMarkdown(DEMOS.FOCUS),
    COSMOS: encodeMarkdown(DEMOS.COSMOS),
    GEOMETRY: encodeMarkdown(DEMOS.GEOMETRY),
    ENERGY: encodeMarkdown(DEMOS.ENERGY),
  }), []);

  const presetLinks = (
    <>
      <a 
        href={`?m=${encodedDemos.DEMO}`}
        className={`px-3 py-1 text-xs font-medium rounded-full text-center transition-all ${(markdown === DEMOS.DEMO) ? 'text-emerald-400 bg-zinc-800/80 shadow-inner' : 'text-zinc-500 hover:text-zinc-300'}`}
      >
        demo
      </a>
      <a 
        href={`?m=${encodedDemos.FOCUS}`}
        className={`px-3 py-1 text-xs font-medium rounded-full text-center transition-all ${markdown === DEMOS.FOCUS ? 'text-emerald-400 bg-zinc-800/80 shadow-inner' : 'text-zinc-500 hover:text-zinc-300'}`}
      >
        simple
      </a>
      <a 
        href={`?m=${encodedDemos.COSMOS}`}
        className={`px-3 py-1 text-xs font-medium rounded-full text-center transition-all ${markdown === DEMOS.COSMOS ? 'text-emerald-400 bg-zinc-800/80 shadow-inner' : 'text-zinc-500 hover:text-zinc-300'}`}
      >
        trans
      </a>
      <a 
        href={`?m=${encodedDemos.GEOMETRY}`}
        className={`px-3 py-1 text-xs font-medium rounded-full text-center transition-all ${markdown === DEMOS.GEOMETRY ? 'text-emerald-400 bg-zinc-800/80 shadow-inner' : 'text-zinc-500 hover:text-zinc-300'}`}
      >
        guided
      </a>
      <a 
        href={`?m=${encodedDemos.ENERGY}`}
        className={`px-3 py-1 text-xs font-medium rounded-full text-center transition-all ${markdown === DEMOS.ENERGY ? 'text-emerald-400 bg-zinc-800/80 shadow-inner' : 'text-zinc-500 hover:text-zinc-300'}`}
      >
        spicy
      </a>
    </>
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get('m');
    const encrypted = params.get('e');
    let initialMarkdown = DEFAULT_MARKDOWN;
    
    if (encrypted) {
      setEncryptedPayload(encrypted);
      return;
    }

    if (encoded) {
      const decoded = decodeMarkdown(encoded);
      if (decoded) {
        initialMarkdown = decoded;
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
    setIsShareOpen(true);
  };

  const handleDecrypt = (e: React.FormEvent) => {
    e.preventDefault();
    setDecryptionError('');
    setIsDecrypting(true);

    // Small delay for UX
    setTimeout(() => {
      try {
        if (!encryptedPayload) return;
        const bytes = CryptoJS.AES.decrypt(encryptedPayload, decryptionPassword);
        const decrypted = bytes.toString(CryptoJS.enc.Utf8);
        
        if (!decrypted) {
          throw new Error('Invalid password');
        }

        setMarkdown(decrypted);
        setEncryptedPayload(null);
        setDecryptionPassword('');
      } catch (err) {
        console.error("Decryption failed", err);
        setDecryptionError('Incorrect password. Please try again.');
      } finally {
        setIsDecrypting(false);
      }
    }, 500);
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
    
    if (sceneManagerRef.current) {
      sceneManagerRef.current.onPlayPause = () => {
        setIsPlaying(prev => {
          if (prev) {
            audioEngine.stopAll();
            return false;
          } else {
            if (segments.length > 0) {
              setCurrentSegmentIndex(0);
              setTimeElapsed(0);
              setMode('view');
              return true;
            }
            return false;
          }
        });
      };
      sceneManagerRef.current.onNext = () => {
        setCurrentSegmentIndex(prev => {
          if (prev < segments.length - 1) {
            setTimeElapsed(0);
            return prev + 1;
          }
          return prev;
        });
      };
      sceneManagerRef.current.onPrev = () => {
        setCurrentSegmentIndex(prev => {
          if (prev > 0) {
            setTimeElapsed(0);
            return prev - 1;
          }
          return prev;
        });
      };
      sceneManagerRef.current.onToggleMode = () => {
        setMode(prev => prev === 'edit' ? 'view' : 'edit');
      };
      sceneManagerRef.current.onVolumeUp = () => {
        const currentVol = audioEngine.getVolume();
        audioEngine.setVolume(currentVol + 0.1);
      };
      sceneManagerRef.current.onVolumeDown = () => {
        const currentVol = audioEngine.getVolume();
        audioEngine.setVolume(currentVol - 0.1);
      };
    }

    return () => {
      if (sceneManagerRef.current) {
        sceneManagerRef.current.dispose();
        sceneManagerRef.current = null;
      }
    };
  }, [segments.length]); // Re-bind if segments change, but mostly we just need the refs to be stable

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
        sceneManagerRef.current.updateText(currentSegment.text, currentSegment.auxText, currentSegment.wordList);
        sceneManagerRef.current.updateMedia(currentSegment.media);
        sceneManagerRef.current.updateXRProgress(timeElapsed, currentSegment.config.duration);
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
        setTimeElapsed(prev => {
          const next = prev + 1;
          if (sceneManagerRef.current) {
            sceneManagerRef.current.updateXRProgress(next, currentSegment.config.duration);
          }
          return next;
        });
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
    if (file && (file.type.startsWith('audio/') || file.type.startsWith('video/'))) {
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
      className="relative flex h-screen w-full bg-zinc-950 text-zinc-100 font-sans overflow-hidden"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      {/* Sidebar / Editor */}
      <div 
        className={`flex flex-col border-r border-zinc-800 bg-zinc-900 transition-all duration-300 ${mode === 'edit' ? (isMobile ? 'fixed inset-0 z-50 w-full' : 'absolute top-0 left-0 bottom-0 z-40') : 'hidden'}`}
        style={!isMobile ? { width: `${sidebarWidth}px` } : {}}
      >
        <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-950">
          <div className="flex items-center gap-2">
            <SpiralLogo size={18} />
            <h1 className="text-lg font-cursive text-emerald-400">Perfect Cadence</h1>
          </div>
          <div className="flex gap-2">
            {isMobile && (
              <button onClick={() => setMode('view')} className="p-2 text-zinc-400 hover:text-white">
                <X size={20} />
              </button>
            )}
            <button 
              onClick={() => setIsHelpOpen(true)}
              className="p-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              title="Help & Syntax"
            >
              <HelpCircle size={16} />
            </button>
            <button 
              onClick={handleShare}
              className="tutorial-share-btn p-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
            >
              <Share2 size={16} /> Share
            </button>
            <button 
              onClick={isPlaying ? handleStop : handlePlay}
              className={`tutorial-play-btn p-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors ${isPlaying ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'}`}
            >
              {isPlaying ? <><Square size={16} /> Stop</> : <><Play size={16} /> Play</>}
            </button>
          </div>
        </div>
        
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* Resize Handle */}
          {!isMobile && (
            <div 
              className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-emerald-500/50 z-10"
              onMouseDown={handleMouseDown}
            />
          )}
          <div className="tutorial-tabs flex border-b border-zinc-800 bg-zinc-900">
            <button 
              onClick={() => setIsAnalysisOpen(true)}
              className="tutorial-magic-btn px-4 py-3 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800/50 transition-colors border-r border-zinc-800"
              title="Import & Analyze Audio"
            >
              <Wand2 size={18} />
            </button>
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
          <div className="absolute top-0 left-0 right-0 p-4 z-20 bg-gradient-to-b from-black/80 to-transparent flex flex-col gap-4">
            {/* Header Row: Logo/Name + Pill Menu + Action Buttons */}
            <div className="flex justify-between items-center w-full gap-4">
              <div className="flex items-center gap-2">
                <SpiralLogo size={20} />
                <h1 className="text-lg font-cursive text-emerald-400 drop-shadow-md">Perfect Cadence</h1>
              </div>
              
            {/* Pill Menu (Horizontal on desktop/landscape) */}
            {!isPlaying && (
              <div className="hidden lg:flex bg-zinc-900/60 backdrop-blur-md border border-zinc-800/50 rounded-full px-1 py-1 shadow-lg">
                {presetLinks}
              </div>
            )}
            
            <div className="flex gap-2 ml-auto">
              {!isPlaying && (
                <>
                  <button 
                    onClick={handleShare}
                    className="tutorial-share-btn p-2 rounded-lg bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700 backdrop-blur-sm transition-colors flex items-center gap-2 text-sm"
                    title="Share Experience"
                  >
                    <Share2 size={16} />
                  </button>
                  <button 
                    onClick={() => setIsHelpOpen(true)}
                    className="p-2 rounded-lg bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700 backdrop-blur-sm transition-colors flex items-center gap-2 text-sm"
                    title="Help & Syntax"
                  >
                    <HelpCircle size={16} />
                  </button>
                </>
              )}
              <button 
                onClick={() => setMode('edit')}
                className="p-2 rounded-lg bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700 backdrop-blur-sm transition-colors flex items-center gap-2 text-sm"
                title="Edit Timeline"
              >
                <Edit3 size={16} /> {!isPlaying && <span className="hidden sm:inline">Edit</span>}
              </button>
              <button 
                onClick={isPlaying ? handleStop : handlePlay}
                className={`tutorial-play-btn p-2 rounded-lg flex items-center gap-2 text-sm font-medium backdrop-blur-sm transition-colors ${isPlaying ? 'bg-red-500/80 text-white hover:bg-red-600' : 'bg-emerald-500/80 text-white hover:bg-emerald-600'}`}
                title={isPlaying ? "Stop" : "Play"}
              >
                {isPlaying ? <Square size={16} /> : <><Play size={16} /> <span className="hidden sm:inline">Play</span></>}
              </button>
            </div>
          </div>

          {/* Presets Row: Vertical in portrait (visible only on mobile/portrait) */}
          {!isPlaying && (
            <div className="lg:hidden flex justify-start">
              <div className="flex flex-col bg-zinc-900/60 backdrop-blur-md border border-zinc-800/50 rounded-2xl px-1 py-1 shadow-lg w-fit">
                {presetLinks}
              </div>
            </div>
          )}
          </div>
        )}
        {/* 3D Canvas */}
        <canvas 
          ref={canvasRef} 
          className="w-full h-full outline-none touch-none absolute inset-0 z-0"
          onClick={() => {
            setMode('view');
            setIsHelpOpen(false);
          }}
        />

        {/* Demo Preset Button */}
        {markdown === DEMOS.DEMO && (
          <button
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-4 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.5)] hover:bg-emerald-500/30 hover:shadow-[0_0_25px_rgba(16,185,129,0.7)] transition-all duration-300 group"
            title="add binaural audio"
            onClick={() => {
              const parsedSegments = parseTimeline(markdown);
              const binaurals = ['focus', 'relax', 'sleep'];
              parsedSegments.forEach(seg => {
                seg.config.binaural = binaurals[Math.floor(Math.random() * binaurals.length)];
              });
              const newMarkdown = serializeTimeline(parsedSegments);
              setMarkdown(newMarkdown);
            }}
          >
            <Ear size={24} />
          </button>
        )}

        {/* Markdown Text Overlay */}
        {/* Removed: Unstyled white copy of the segment text */}

        {/* Playback Progress Overlay */}
        {isPlaying && segments.length > 0 && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-md px-4 z-20 transition-opacity duration-500 opacity-0 hover:opacity-100">
            <div className="bg-zinc-900/40 backdrop-blur-sm border border-zinc-800/50 rounded-2xl p-4 shadow-2xl">
              <div className="flex justify-between text-xs text-zinc-400/70 mb-2 font-mono">
                <span>Segment {currentSegmentIndex + 1} / {segments.length}</span>
                <span>{Math.floor(totalElapsed)}s / {Math.floor(totalDuration)}s</span>
              </div>
              <div 
                className="w-full h-2 bg-zinc-800/50 rounded-full overflow-hidden cursor-pointer relative"
                onClick={handleScrub}
              >
                <div 
                  className="h-full bg-emerald-500/70 transition-all duration-100 ease-linear"
                  style={{ width: `${(totalElapsed / totalDuration) * 100}%` }}
                />
              </div>
              <div className="mt-3 text-center text-[10px] font-medium text-zinc-500/70 uppercase tracking-widest">
                {segments[currentSegmentIndex].config.pattern} • {segments[currentSegmentIndex].config.binaural}
              </div>
            </div>
          </div>
        )}

        <AudioAnalysisFlyout 
        isOpen={isAnalysisOpen} 
        onClose={() => setIsAnalysisOpen(false)} 
        onAnalysisComplete={(newSegments) => {
          setMarkdown(serializeTimeline(newSegments));
        }} 
      />

      <ShareFlyout 
        isOpen={isShareOpen} 
        onClose={() => setIsShareOpen(false)} 
        markdown={markdown}
      />

      <Joyride
        steps={tutorialSteps}
        run={runTutorial}
        continuous={true}
        showSkipButton={true}
        callback={handleJoyrideCallback}
        styles={{
          options: {
            primaryColor: '#10b981',
            backgroundColor: '#18181b',
            textColor: '#f4f4f5',
            arrowColor: '#18181b',
            overlayColor: 'rgba(0, 0, 0, 0.8)',
          },
          tooltip: {
            border: '1px solid #27272a',
            borderRadius: '12px',
          },
        }}
      />

      {showWarning && <SeizureWarning onClose={handleCloseWarning} />}

      {/* Decryption UI Overlay */}
      {encryptedPayload && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950 p-4">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl flex flex-col items-center gap-6">
            <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center">
              <Lock size={40} className="text-emerald-400" />
            </div>
            
            <div className="text-center">
              <h2 className="text-2xl font-bold text-zinc-100 mb-2">Encrypted Experience</h2>
              <p className="text-zinc-400 text-sm">This timeline is protected by a secret key. Enter the password to unlock it.</p>
            </div>

            <form onSubmit={handleDecrypt} className="w-full flex flex-col gap-4">
              <div className="relative">
                <input 
                  type="password"
                  autoFocus
                  placeholder="Enter secret key..."
                  value={decryptionPassword}
                  onChange={(e) => setDecryptionPassword(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-4 text-center text-lg text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                />
              </div>

              {decryptionError && (
                <div className="flex items-center gap-2 text-red-400 text-sm justify-center animate-in fade-in slide-in-from-top-1">
                  <AlertCircle size={14} />
                  <span>{decryptionError}</span>
                </div>
              )}

              <button 
                type="submit"
                disabled={isDecrypting || !decryptionPassword}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20"
              >
                {isDecrypting ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    <span>Decrypting...</span>
                  </>
                ) : (
                  <>
                    <Unlock size={20} />
                    <span>Unlock Experience</span>
                  </>
                )}
              </button>
            </form>

            <button 
              onClick={() => {
                setEncryptedPayload(null);
                window.history.replaceState({}, '', window.location.pathname);
                setMarkdown(DEFAULT_MARKDOWN);
              }}
              className="text-zinc-500 hover:text-zinc-300 text-xs font-medium uppercase tracking-widest transition-colors"
            >
              Cancel and load default
            </button>
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
            <div className="mb-6 p-4 bg-zinc-950 border border-zinc-800 rounded-xl">
              <p className="text-zinc-300 text-xs mb-2">Want to learn more or contribute to the project?</p>
              <a 
                href="https://github.com/ritz-srekcarc/perfect-cadence" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 font-medium no-underline"
              >
                View on GitHub →
              </a>
              <div className="border-t border-zinc-800 pt-4 mt-4">
                <button 
                  onClick={() => {
                    setIsHelpOpen(false);
                    setMode('edit');
                    setTimeout(() => {
                      setRunTutorial(true);
                    }, 400);
                  }}
                  className="w-full py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-lg text-sm font-medium transition-colors"
                >
                  Start Interactive Tutorial
                </button>
              </div>
            </div>

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

            <h3 className="text-zinc-100 mt-6">Text Styling</h3>
            <p className="text-zinc-400 font-medium text-xs bg-emerald-500/10 border border-emerald-500/20 p-2 rounded-lg mb-4">
              <span className="text-emerald-400">Note:</span> Primary text is fixed to the pattern center in world space. Auxiliary text (blockquote) is locked to your camera view.
            </p>
            <p className="text-zinc-400">Basic markdown styling is supported in the WebXR canvas:</p>
            <ul className="text-zinc-400 space-y-2">
              <li><strong className="text-zinc-200">Headers:</strong> Start a line with <code>#</code> to make it larger and bold.</li>
              <li><strong className="text-zinc-200">Bold:</strong> Wrap text in <code>**</code> (e.g., <code>**bold**</code>).</li>
              <li><strong className="text-zinc-200">Italic:</strong> Wrap text in <code>*</code> or <code>_</code> (e.g., <code>*italic*</code>).</li>
              <li><strong className="text-zinc-200">Auxiliary Text:</strong> Start a line with <code>&gt;</code> to render it as a separate blockquote layer.</li>
            </ul>
            
            <h3 className="text-zinc-100 mt-6">Options</h3>
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
              <li><strong className="text-zinc-200">audioUrl:</strong> URL to custom audio or video file (string). You can also drag and drop an audio or video file onto the window.</li>
            </ul>

            <h3 className="text-zinc-100 mt-6">Wordlists</h3>
            <p className="text-zinc-400">Display a sequence of words: <code>!{`{interval,pattern}(word1,word2)`}</code></p>
            <ul className="text-zinc-400 space-y-2">
              <li><strong className="text-zinc-200">interval:</strong> Seconds per word</li>
              <li><strong className="text-zinc-200">pattern:</strong> <code>center</code>, <code>scatter</code>, <code>random</code></li>
              <li><strong className="text-zinc-200">Pre-built lists:</strong> Use a single word to load a list: <code>relax</code>, <code>focus</code>, <code>sleep</code>, <code>confidence</code>, <code>energy</code>. Example: <code>!{`{3,scatter}(relax)`}</code></li>
            </ul>

            <h3 className="text-zinc-100 mt-6">Images & Videos</h3>
            <p className="text-zinc-400">Add media using markdown syntax with opacity: <code>![opacity](url)</code> or <code>![opacity,volume](url)</code></p>
            <ul className="text-zinc-400 space-y-2">
              <li><strong className="text-zinc-200">opacity:</strong> 0-100 (e.g., <code>![50](https://example.com/image.jpg)</code>)</li>
              <li><strong className="text-zinc-200">volume:</strong> 0-100 (optional, implies video). Example: <code>![50,80](https://example.com/video.mp4)</code></li>
              <li><strong className="text-zinc-200">Video:</strong> URLs ending in .mp4, .webm, or .ogg will play automatically. If a volume is provided, it will always be treated as a video.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

