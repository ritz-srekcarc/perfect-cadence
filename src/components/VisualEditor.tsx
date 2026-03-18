import React, { useState, useRef, useEffect } from 'react';
import { TimelineSegment, SegmentConfig, parseSegmentContent, MediaItem } from '../timelineParser';
import { Trash2, Plus, ArrowUp, ArrowDown, Upload, ChevronDown, ChevronRight, Sparkles, Loader2, Info, Bold, Italic, Heading1, Heading2, List, ListOrdered, Ear, Timer, Image, Video, Volume2, Paintbrush, Film, X } from 'lucide-react';
import { transcribeAudio } from '../services/audioAnalysisService';
import Editor from 'react-simple-code-editor';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import Prism from 'prismjs';
import 'prismjs/components/prism-markdown';
import 'prismjs/themes/prism-tomorrow.css';

/**
 * VisualEditor
 * 
 * Provides a GUI for editing the timeline segments.
 * Allows users to modify configuration parameters and markdown content
 * without manually editing the markdown string.
 */
interface VisualEditorProps {
  segments: TimelineSegment[];
  onChange: (segments: TimelineSegment[]) => void;
}

interface SegmentEditorProps {
  key?: string;
  seg: TimelineSegment;
  index: number;
  totalSegments: number;
  updateConfig: (index: number, key: keyof SegmentConfig, value: any) => void;
  updateMarkdown: (index: number, markdown: string) => void;
  moveSegment: (index: number, dir: number) => void;
  removeSegment: (index: number) => void;
}

const SliderInput = ({ label, value, min, max, step, onChange }: { label: string, value: number, min: number, max: number, step: number, onChange: (val: number) => void }) => (
  <div className="flex flex-col gap-1">
    <div className="flex justify-between items-center">
      <label className="text-[10px] text-zinc-500">{label}</label>
      <span className="text-[10px] text-zinc-400 font-mono">{value}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full accent-emerald-500"
    />
  </div>
);

// Simple markdown-to-html for Quill
const toHtml = (md: string) => {
  if (!md) return '<p><br></p>';
  
  let lines = md.split('\n');
  let htmlLines = lines.map(line => {
    let processed = line;
    
    // Bold
    processed = processed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Italic
    processed = processed.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // Media
    processed = processed.replace(/!\[(\d+)(?:,(\d+))?\]\((.*?)\)/g, '<span class="text-emerald-400">[Media: $3]</span>');
    // Wordlist
    processed = processed.replace(/!\{([\d.]+),\s*(\d+)\}\(([^)]+)\)/g, '<span class="text-emerald-400">[Wordlist: $3]</span>');

    // Block elements - don't wrap these in <p>
    if (processed.startsWith('# ')) {
      return `<h1>${processed.substring(2)}</h1>`;
    }
    if (processed.startsWith('> ')) {
      return `<blockquote>${processed.substring(2)}</blockquote>`;
    }
    
    return processed.trim() ? `<p>${processed}</p>` : '<p><br></p>';
  });
  
  return htmlLines.join('');
};

// Simple html-to-markdown from Quill
const fromHtml = (html: string) => {
  if (!html || html === '<p><br></p>') return '';
  
  let md = html;
  // Replace non-breaking spaces with regular spaces
  md = md.replace(/&nbsp;/g, ' ');
  md = md.replace(/\u00A0/g, ' ');

  // Convert block elements first
  md = md.replace(/<h1>(.*?)<\/h1>/g, '# $1\n');
  md = md.replace(/<blockquote>(.*?)<\/blockquote>/g, '> $1\n');
  
  // Inline formatting
  md = md.replace(/<strong>(.*?)<\/strong>/g, '**$1**');
  md = md.replace(/<b>(.*?)<\/b>/g, '**$1**');
  md = md.replace(/<em>(.*?)<\/em>/g, '*$1*');
  md = md.replace(/<i>(.*?)<\/i>/g, '*$1*');
  
  // Paragraphs and breaks
  md = md.replace(/<p>(.*?)<\/p>/g, '$1\n');
  md = md.replace(/<br\s*\/?>/g, '\n');
  
  // Strip remaining tags
  md = md.replace(/<[^>]+>/g, '');
  
  // Clean up multiple newlines that might have been introduced
  return md.replace(/\n{3,}/g, '\n\n').trim();
};

const RichTextEditor = ({ markdown, onChange, onInsertImage, onInsertVideo, onInsertWordlist, onOpenPaintbrush, onOpenFilm }: { 
  markdown: string, 
  onChange: (md: string) => void,
  onInsertImage: () => void,
  onInsertVideo: () => void,
  onInsertWordlist: () => void,
  onOpenPaintbrush: (isAux: boolean) => void,
  onOpenFilm: (isAux: boolean) => void
}) => {
  const quillRef = useRef<ReactQuill>(null);
  const toolbarId = `toolbar-${Math.random().toString(36).substr(2, 9)}`;

  const handlePaintbrushClick = () => {
    if (quillRef.current) {
      const quill = quillRef.current.getEditor();
      const format = quill.getFormat();
      onOpenPaintbrush(!!format.blockquote);
    }
  };

  const handleFilmClick = () => {
    if (quillRef.current) {
      const quill = quillRef.current.getEditor();
      const format = quill.getFormat();
      onOpenFilm(!!format.blockquote);
    }
  };

  const QuillComponent = ReactQuill as any;

  return (
    <div className="rich-text-editor bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden">
      <div id={toolbarId} className="ql-toolbar ql-snow flex items-center gap-1">
        <span className="ql-formats flex items-center gap-1">
          <button className="ql-header" value="1"></button>
          <button className="ql-bold"></button>
          <button className="ql-italic"></button>
          <button className="ql-blockquote"></button>
          <button onClick={handlePaintbrushClick} className="!w-auto !h-auto p-1 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded flex items-center justify-center" title="Style Settings">
            <Paintbrush size={16} />
          </button>
          <button onClick={handleFilmClick} className="!w-auto !h-auto p-1 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded flex items-center justify-center" title="Animation Settings">
            <Film size={16} />
          </button>
        </span>
        <span className="ql-formats !mr-0 flex items-center gap-1 border-l border-zinc-800 pl-2 ml-1">
          <button onClick={onInsertImage} className="!w-auto !h-auto p-1 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded flex items-center justify-center" title="Insert Image">
            <Image size={16} />
          </button>
          <button onClick={onInsertVideo} className="!w-auto !h-auto p-1 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded flex items-center justify-center" title="Insert Video">
            <Video size={16} />
          </button>
          <button onClick={onInsertWordlist} className="!w-auto !h-auto p-1 text-emerald-400 hover:text-emerald-300 hover:bg-zinc-800 rounded flex items-center justify-center" title="Insert Wordlist">
            <Sparkles size={16} />
          </button>
        </span>
      </div>
      <QuillComponent 
        ref={quillRef}
        theme="snow"
        value={toHtml(markdown)}
        onChange={(content, delta, source) => {
          if (source === 'user') {
            const newMd = fromHtml(content);
            if (newMd !== markdown) {
              onChange(newMd);
            }
          }
        }}
        modules={{
          toolbar: `#${toolbarId}`
        }}
        className="text-zinc-200"
      />
      <style>{`
        .ql-toolbar.ql-snow { border: none; background: #18181b; border-bottom: 1px solid #27272a; padding: 4px 8px; display: flex; align-items: center; }
        .ql-container.ql-snow { border: none; font-family: inherit; font-size: 0.875rem; }
        .ql-editor { min-height: 100px; color: #e4e4e7; padding: 12px; }
        .ql-snow .ql-stroke { stroke: #a1a1aa; }
        .ql-snow .ql-fill { fill: #a1a1aa; }
        .ql-snow .ql-picker { color: #a1a1aa; }
        .ql-snow.ql-toolbar button:hover .ql-stroke { stroke: #fff; }
        .ql-snow.ql-toolbar button:hover .ql-fill { fill: #fff; }
        .ql-snow.ql-toolbar button.ql-active .ql-stroke { stroke: #10b981; }
        .ql-snow.ql-toolbar button.ql-active .ql-fill { fill: #10b981; }
      `}</style>
    </div>
  );
};

/**
 * SegmentEditor
 * 
 * A sub-component for editing a single segment within the VisualEditor.
 */
function SegmentEditor({ seg, index, totalSegments, updateConfig, updateMarkdown, moveSegment, removeSegment }: SegmentEditorProps) {
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isAdvancedAnimOpen, setIsAdvancedAnimOpen] = useState(false);
  const [isAdvancedCamOpen, setIsAdvancedCamOpen] = useState(false);
  const [activeBubble, setActiveBubble] = useState<{ type: 'style' | 'animation', isAux: boolean } | null>(null);
  const [isAdvancedAudioOpen, setIsAdvancedAudioOpen] = useState(false);
  const [isAdvancedSpeechOpen, setIsAdvancedSpeechOpen] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const parsed = parseSegmentContent(seg.rawMarkdown);
  const primaryText = parsed.text;
  const auxText = parsed.auxText || '';
  const media = parsed.media;

  const buildMarkdown = (primary: string, aux: string, mediaList: MediaItem[]) => {
    const mainMedia = mediaList.filter(m => m.layer === 'main');
    const auxMedia = mediaList.filter(m => m.layer === 'aux');

    let md = primary.trim();
    if (mainMedia.length > 0) {
      md += '\n\n' + mainMedia.map(m => `![${Math.round(m.opacity * 100)}${m.volume !== undefined ? ',' + Math.round(m.volume * 100) : ''}](${m.url})`).join('\n');
    }

    if (aux.trim() || auxMedia.length > 0) {
      let auxContent = aux.trim();
      if (auxMedia.length > 0) {
        auxContent += '\n\n' + auxMedia.map(m => `![${Math.round(m.opacity * 100)}${m.volume !== undefined ? ',' + Math.round(m.volume * 100) : ''}](${m.url})`).join('\n');
      }
      md += '\n\n' + auxContent.split('\n').map(line => `> ${line}`).join('\n');
    }

    return md;
  };

  const handlePrimaryTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateMarkdown(index, buildMarkdown(e.target.value, auxText, media));
  };

  const handleAuxTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateMarkdown(index, buildMarkdown(primaryText, e.target.value, media));
  };

  const handleMediaChange = (mediaIndex: number, field: keyof MediaItem, value: any) => {
    const newMedia = [...media];
    newMedia[mediaIndex] = { ...newMedia[mediaIndex], [field]: value };
    updateMarkdown(index, buildMarkdown(primaryText, auxText, newMedia));
  };

  const addMedia = () => {
    const newMedia: MediaItem[] = [...media, { type: 'image', url: '', opacity: 1, layer: 'main' }];
    updateMarkdown(index, buildMarkdown(primaryText, auxText, newMedia));
  };

  const removeMedia = (mediaIndex: number) => {
    const newMedia = media.filter((_, i) => i !== mediaIndex);
    updateMarkdown(index, buildMarkdown(primaryText, auxText, newMedia));
  };

  const handleTranscribe = async () => {
    if (!seg.config.audioUrl) return;
    setIsTranscribing(true);
    try {
      const text = await transcribeAudio(seg.config.audioUrl);
      // Append transcribed text to rawMarkdown
      updateMarkdown(index, seg.rawMarkdown + '\n' + text);
    } finally {
      setIsTranscribing(false);
    }
  };

  const scrollToSection = (sectionId: string, openStates: (() => void)[]) => {
    openStates.forEach(open => open());
    setTimeout(() => {
      const el = document.getElementById(sectionId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-emerald-500/50', 'transition-all');
        setTimeout(() => el.classList.remove('ring-2', 'ring-emerald-500/50'), 2000);
      }
    }, 100);
  };

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 flex flex-col gap-1 relative group">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Segment {index + 1}</span>
          <div className="flex items-center gap-1">
            <button 
              onClick={() => scrollToSection(`advanced-audio-${index}`, [() => setIsConfigOpen(true), () => setIsAdvancedAudioOpen(true)])}
              className="text-[10px] flex items-center gap-1 text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 px-2 py-1 rounded"
            >
              <Volume2 size={10} />
              Add Audio
            </button>
            <button 
              onClick={() => scrollToSection(`binaural-${index}`, [() => setIsConfigOpen(true)])}
              className="p-1 text-zinc-400 hover:text-emerald-400 bg-zinc-900 rounded"
              title="Binaural Options"
            >
              <Ear size={12} />
            </button>
            <button 
              onClick={() => scrollToSection(`metronome-${index}`, [() => setIsConfigOpen(true), () => setIsAdvancedAudioOpen(true)])}
              className="p-1 text-zinc-400 hover:text-emerald-400 bg-zinc-900 rounded"
              title="Metronome Options"
            >
              <Timer size={12} />
            </button>
          </div>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => moveSegment(index, -1)} disabled={index === 0} className="p-1 text-zinc-400 hover:text-white disabled:opacity-30"><ArrowUp size={16}/></button>
          <button onClick={() => moveSegment(index, 1)} disabled={index === totalSegments - 1} className="p-1 text-zinc-400 hover:text-white disabled:opacity-30"><ArrowDown size={16}/></button>
          <button onClick={() => removeSegment(index)} className="p-1 text-red-400 hover:text-red-300 ml-2"><Trash2 size={16}/></button>
        </div>
      </div>

      <div className="flex flex-col gap-2 relative">
        <RichTextEditor 
          markdown={seg.rawMarkdown}
          onChange={(md) => updateMarkdown(index, md)}
          onInsertImage={() => {
            const url = prompt('Enter Image URL:');
            if (url) updateMarkdown(index, seg.rawMarkdown + `\n\n![100](${url})`);
          }}
          onInsertVideo={() => {
            const url = prompt('Enter Video URL:');
            if (url) updateMarkdown(index, seg.rawMarkdown + `\n\n![100,100](${url})`);
          }}
          onInsertWordlist={() => {
            updateMarkdown(index, seg.rawMarkdown + `\n\n!{1.0,1}(relax)`);
          }}
          onOpenPaintbrush={(isAux) => setActiveBubble(activeBubble?.type === 'style' && activeBubble.isAux === isAux ? null : { type: 'style', isAux })}
          onOpenFilm={(isAux) => setActiveBubble(activeBubble?.type === 'animation' && activeBubble.isAux === isAux ? null : { type: 'animation', isAux })}
        />

        {activeBubble && (
          <div className="absolute top-12 right-0 z-50 w-80 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl p-4 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                {activeBubble.type === 'style' ? <Paintbrush size={14} /> : <Film size={14} />}
                {activeBubble.isAux ? 'Aux' : 'Text'} {activeBubble.type === 'style' ? 'Style' : 'Animation'}
              </h4>
              <button onClick={() => setActiveBubble(null)} className="p-1 text-zinc-500 hover:text-white transition-colors">
                <X size={14} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {activeBubble.type === 'style' ? (
                <>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-zinc-500 uppercase font-bold">Font</label>
                    <select 
                      value={(activeBubble.isAux ? seg.config.auxFont : seg.config.textFont) || 'sans-serif'} 
                      onChange={(e) => updateConfig(index, activeBubble.isAux ? 'auxFont' : 'textFont', e.target.value)} 
                      className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="sans-serif">Sans-Serif</option>
                      <option value="serif">Serif</option>
                      <option value="monospace">Monospace</option>
                      <option value="cursive">Cursive</option>
                      <option value="fantasy">Fantasy</option>
                    </select>
                  </div>
                  <SliderInput
                    label="Distance"
                    min={1} max={50} step={1}
                    value={(activeBubble.isAux ? seg.config.auxDistance : seg.config.textDistance) ?? 10}
                    onChange={(val) => updateConfig(index, activeBubble.isAux ? 'auxDistance' : 'textDistance', val)}
                  />
                  <SliderInput
                    label="Size"
                    min={10} max={300} step={1}
                    value={(activeBubble.isAux ? seg.config.auxSize : seg.config.textSize) ?? 100}
                    onChange={(val) => updateConfig(index, activeBubble.isAux ? 'auxSize' : 'textSize', val)}
                  />
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-zinc-500 uppercase font-bold">Outline</label>
                    <select 
                      value={(activeBubble.isAux ? seg.config.auxOutlineType : seg.config.textOutlineType) || 'none'} 
                      onChange={(e) => updateConfig(index, activeBubble.isAux ? 'auxOutlineType' : 'textOutlineType', e.target.value)} 
                      className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="none">None</option>
                      <option value="rainbow">Rainbow</option>
                      <option value="solid">Solid</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-zinc-500 uppercase font-bold">Color</label>
                    <input 
                      type="color" 
                      value={(activeBubble.isAux ? seg.config.auxColor : seg.config.textColor) || '#ffffff'} 
                      onChange={(e) => updateConfig(index, activeBubble.isAux ? 'auxColor' : 'textColor', e.target.value)} 
                      className="bg-zinc-950 border border-zinc-800 rounded-lg px-1 py-0.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 h-8 w-full" 
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-zinc-500 uppercase font-bold">Shading</label>
                    <select 
                      value={(activeBubble.isAux ? seg.config.auxShading : seg.config.textShading) ? 'true' : 'false'} 
                      onChange={(e) => updateConfig(index, activeBubble.isAux ? 'auxShading' : 'textShading', e.target.value === 'true')} 
                      className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="false">Off</option>
                      <option value="true">On</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-zinc-500 uppercase font-bold">Backdrop</label>
                    <select 
                      value={(activeBubble.isAux ? seg.config.auxBackdrop : seg.config.textBackdrop) ? 'true' : 'false'} 
                      onChange={(e) => updateConfig(index, activeBubble.isAux ? 'auxBackdrop' : 'textBackdrop', e.target.value === 'true')} 
                      className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="false">Off</option>
                      <option value="true">On</option>
                    </select>
                  </div>
                  {!activeBubble.isAux && (
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-zinc-500 uppercase font-bold">Pattern</label>
                      <select 
                        value={seg.config.textDisplayPattern || 'center'} 
                        onChange={(e) => updateConfig(index, 'textDisplayPattern', e.target.value)} 
                        className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      >
                        <option value="center">Center</option>
                        <option value="scatter">Scatter</option>
                        <option value="random">Random</option>
                        <option value="spiral">Spiral</option>
                        <option value="march">March</option>
                      </select>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="flex flex-col gap-1 col-span-2">
                    <label className="text-[10px] text-zinc-500 uppercase font-bold">Animation Type</label>
                    <select 
                      value={(activeBubble.isAux ? seg.config.auxAnimType : seg.config.textAnimType) || 'none'} 
                      onChange={(e) => updateConfig(index, activeBubble.isAux ? 'auxAnimType' : 'textAnimType', e.target.value)} 
                      className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="none">None</option>
                      <option value="zoom">Zoom</option>
                      <option value="fade">Fade</option>
                      <option value="float">Float</option>
                      <option value="warp">Warp</option>
                      <option value="prism">Prism</option>
                      <option value="glitch">Glitch</option>
                    </select>
                  </div>
                  <SliderInput
                    label="Speed"
                    min={0} max={5} step={0.1}
                    value={(activeBubble.isAux ? seg.config.auxAnimSpeed : seg.config.textAnimSpeed) ?? 1.0}
                    onChange={(val) => updateConfig(index, activeBubble.isAux ? 'auxAnimSpeed' : 'textAnimSpeed', val)}
                  />
                  <SliderInput
                    label="Intensity"
                    min={0} max={5} step={0.1}
                    value={(activeBubble.isAux ? seg.config.auxAnimIntensity : seg.config.textAnimIntensity) ?? 1.0}
                    onChange={(val) => updateConfig(index, activeBubble.isAux ? 'auxAnimIntensity' : 'textAnimIntensity', val)}
                  />
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="relative group/duration py-1">
        <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 opacity-0 group-hover/duration:opacity-100 transition-opacity pointer-events-none text-[10px] font-mono text-emerald-400 bg-zinc-950/90 px-2 py-0.5 rounded border border-emerald-500/30 shadow-xl z-20 backdrop-blur-sm">
          {seg.config.duration < 60 
            ? `${seg.config.duration.toFixed(2)}s` 
            : seg.config.duration < 3600 
              ? `${Math.floor(seg.config.duration / 60)}m ${Math.round(seg.config.duration % 60)}s`
              : `${Math.floor(seg.config.duration / 3600)}h ${Math.floor((seg.config.duration % 3600) / 60)}m`}
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.0001"
          value={Math.log(seg.config.duration / 0.1) / Math.log(14400 / 0.1)}
          onChange={(e) => {
            const p = parseFloat(e.target.value);
            // Geometric progression: d = a * (b/a)^p
            const raw = 0.1 * Math.pow(14400 / 0.1, p);
            let snapped = raw;
            if (raw < 1) snapped = Math.round(raw * 100) / 100;
            else if (raw < 10) snapped = Math.round(raw * 10) / 10;
            else snapped = Math.round(raw);
            updateConfig(index, 'duration', snapped);
          }}
          className="w-full h-[2px] bg-zinc-800 rounded-full appearance-none cursor-pointer accent-emerald-500 hover:accent-emerald-400 transition-all"
        />
      </div>

      <div className="border border-zinc-800 rounded-lg overflow-hidden">
        <button 
          onClick={() => setIsConfigOpen(!isConfigOpen)}
          className="w-full flex items-center justify-between p-3 bg-zinc-900/50 hover:bg-zinc-900 text-sm font-medium text-zinc-300 transition-colors"
        >
          <span>Pattern/Cam/Audio</span>
          {isConfigOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        
        {isConfigOpen && (
          <div className="p-4 bg-zinc-950 flex flex-col gap-4 border-t border-zinc-800">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-500">Pattern</label>
                <select value={seg.config.pattern} onChange={(e) => updateConfig(index, 'pattern', e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500">
                  <option value="spiral">Spiral</option>
                  <option value="tunnel">Tunnel</option>
                  <option value="rings">Rings</option>
                  <option value="particles">Particles</option>
                  <option value="mandala">Mandala</option>
                  <option value="kaleidoscope">Kaleidoscope</option>
                  <option value="waves">Waves</option>
                  <option value="pulse">Pulse</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-500">Pattern Type</label>
                <select value={seg.config.patternType || 'default'} onChange={(e) => updateConfig(index, 'patternType', e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500">
                  <option value="default">Default</option>
                  <option value="double">Double (Spiral)</option>
                  <option value="galaxy">Galaxy (Spiral)</option>
                  <option value="sphere">Sphere (Rings)</option>
                  <option value="cylinder">Cylinder (Rings)</option>
                  <option value="hypnotic">Hypnotic</option>
                  <option value="breathing">Breathing</option>
                  <option value="infinite">Infinite</option>
                  <option value="vortex">Vortex</option>
                  <option value="sacred_geometry">Sacred Geometry</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-500">Pattern Face Camera</label>
                <select value={seg.config.patternFaceCamera === undefined ? 'true' : (seg.config.patternFaceCamera ? 'true' : 'false')} onChange={(e) => updateConfig(index, 'patternFaceCamera', e.target.value === 'true')} className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500">
                  <option value="false">Off</option>
                  <option value="true">On</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-500">Camera</label>
                <select value={seg.config.camera} onChange={(e) => updateConfig(index, 'camera', e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500">
                  <option value="static">Static</option>
                  <option value="orbit">Orbit</option>
                  <option value="fly">Fly</option>
                  <option value="pan">Pan</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <SliderInput
                  label="Camera Speed"
                  min={0}
                  max={5}
                  step={0.1}
                  value={seg.config.cameraSpeed ?? 1.0}
                  onChange={(val) => updateConfig(index, 'cameraSpeed', val)}
                />
              </div>
              <div id={`binaural-${index}`} className="flex flex-col gap-1">
                <label className="text-xs text-zinc-500">Binaural</label>
                <select value={seg.config.binaural} onChange={(e) => updateConfig(index, 'binaural', e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500">
                  <option value="off">Off</option>
                  <option value="focus">Focus</option>
                  <option value="relax">Relax</option>
                  <option value="sleep">Sleep</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
            </div>

            <div className="border border-zinc-800 rounded-lg overflow-hidden mt-2">
              <button 
                onClick={() => setIsAdvancedAnimOpen(!isAdvancedAnimOpen)}
                className="w-full flex items-center justify-between p-3 bg-zinc-900/30 hover:bg-zinc-900/80 text-sm font-medium text-zinc-400 transition-colors"
              >
                <span>Advanced Animation</span>
                {isAdvancedAnimOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
              
              {isAdvancedAnimOpen && (
                <div className="p-4 bg-zinc-950 flex flex-col gap-4 border-t border-zinc-800">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                      <SliderInput
                        label="Pattern Speed"
                        min={0}
                        max={5}
                        step={0.1}
                        value={seg.config.patternSpeed ?? 1.0}
                        onChange={(val) => updateConfig(index, 'patternSpeed', val)}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <SliderInput
                        label="Pattern Scale"
                        min={0.1}
                        max={5}
                        step={0.1}
                        value={seg.config.patternScale ?? 1.0}
                        onChange={(val) => updateConfig(index, 'patternScale', val)}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <SliderInput
                        label="Complexity"
                        min={1}
                        max={10}
                        step={1}
                        value={seg.config.patternComplexity ?? 1}
                        onChange={(val) => updateConfig(index, 'patternComplexity', val)}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-zinc-500">Color 1</label>
                      <div className="flex gap-2">
                        <input type="color" value={seg.config.patternColor1 || '#ffffff'} onChange={(e) => updateConfig(index, 'patternColor1', e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded-lg w-10 h-10 p-1 cursor-pointer" />
                        <input type="text" value={seg.config.patternColor1 || ''} onChange={(e) => updateConfig(index, 'patternColor1', e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 flex-1" placeholder="#ffffff" />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-zinc-500">Color 2</label>
                      <div className="flex gap-2">
                        <input type="color" value={seg.config.patternColor2 || '#ffffff'} onChange={(e) => updateConfig(index, 'patternColor2', e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded-lg w-10 h-10 p-1 cursor-pointer" />
                        <input type="text" value={seg.config.patternColor2 || ''} onChange={(e) => updateConfig(index, 'patternColor2', e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 flex-1" placeholder="#ffffff" />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="border border-zinc-800 rounded-lg overflow-hidden mt-2">
              <button 
                onClick={() => setIsAdvancedCamOpen(!isAdvancedCamOpen)}
                className="w-full flex items-center justify-between p-3 bg-zinc-900/30 hover:bg-zinc-900/80 text-sm font-medium text-zinc-400 transition-colors"
              >
                <span>Advanced Camera</span>
                {isAdvancedCamOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
              
              {isAdvancedCamOpen && (
                <div className="p-4 bg-zinc-950 flex flex-col gap-4 border-t border-zinc-800">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-zinc-500">Radius</label>
                      <input type="number" step="0.5" value={seg.config.cameraRadius ?? ''} onChange={(e) => updateConfig(index, 'cameraRadius', parseFloat(e.target.value) || undefined)} className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500" placeholder="Auto" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-zinc-500">Height (Beta)</label>
                      <input type="number" step="0.1" value={seg.config.cameraHeight ?? ''} onChange={(e) => updateConfig(index, 'cameraHeight', parseFloat(e.target.value) || undefined)} className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500" placeholder="Auto" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-zinc-500">Target X</label>
                      <input type="number" step="0.5" value={seg.config.cameraTargetX ?? 0} onChange={(e) => updateConfig(index, 'cameraTargetX', parseFloat(e.target.value) || 0)} className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-zinc-500">Target Y</label>
                      <input type="number" step="0.5" value={seg.config.cameraTargetY ?? 0} onChange={(e) => updateConfig(index, 'cameraTargetY', parseFloat(e.target.value) || 0)} className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-zinc-500">Target Z</label>
                      <input type="number" step="0.5" value={seg.config.cameraTargetZ ?? 0} onChange={(e) => updateConfig(index, 'cameraTargetZ', parseFloat(e.target.value) || 0)} className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-zinc-500">FOV</label>
                      <input type="number" step="0.1" value={seg.config.cameraFov ?? ''} onChange={(e) => updateConfig(index, 'cameraFov', parseFloat(e.target.value) || undefined)} className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500" placeholder="Auto" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div id={`advanced-audio-${index}`} className="border border-zinc-800 rounded-lg overflow-hidden mt-2">
              <button 
                onClick={() => setIsAdvancedAudioOpen(!isAdvancedAudioOpen)}
                className="w-full flex items-center justify-between p-3 bg-zinc-900/30 hover:bg-zinc-900/80 text-sm font-medium text-zinc-400 transition-colors"
              >
                <span>Advanced Audio</span>
                {isAdvancedAudioOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
              
              {isAdvancedAudioOpen && (
                <div className="p-4 bg-zinc-950 flex flex-col gap-4 border-t border-zinc-800">
                  <div id={`metronome-${index}`} className="flex flex-col gap-1">
                    <SliderInput
                      label="Metronome (BPM)"
                      min={0}
                      max={300}
                      step={1}
                      value={seg.config.metronome ?? 0}
                      onChange={(val) => updateConfig(index, 'metronome', val)}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4 pt-2 border-t border-zinc-800">
                    <div className="flex flex-col gap-1">
                      <SliderInput
                        label="Carrier Freq (Hz)"
                        min={0}
                        max={1000}
                        step={1}
                        value={seg.config.carrierFreq ?? 200}
                        onChange={(val) => updateConfig(index, 'carrierFreq', val)}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <SliderInput
                        label="Beat Freq (Hz)"
                        min={0}
                        max={40}
                        step={0.1}
                        value={seg.config.beatFreq ?? 10}
                        onChange={(val) => updateConfig(index, 'beatFreq', val)}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <SliderInput
                        label="Amp Mod (Hz)"
                        min={0}
                        max={40}
                        step={0.1}
                        value={seg.config.ampModulation ?? 0}
                        onChange={(val) => updateConfig(index, 'ampModulation', val)}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1 pt-2 border-t border-zinc-800">
                    <label className="text-xs text-zinc-500">Custom Audio URL</label>
                    <div className="flex gap-2 min-w-0">
                      <input 
                        type="text" 
                        placeholder="https://... or drop an audio/video file anywhere"
                        value={seg.config.audioUrl || ''} 
                        onChange={(e) => updateConfig(index, 'audioUrl', e.target.value)} 
                        className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 min-w-0" 
                      />
                      <button
                        onClick={handleTranscribe}
                        disabled={!seg.config.audioUrl || isTranscribing}
                        className="p-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed border border-zinc-700 rounded-lg text-emerald-400 transition-colors"
                        title="Transcribe Audio"
                      >
                        {isTranscribing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                      </button>
                      <label className="flex items-center justify-center px-3 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg cursor-pointer transition-colors text-zinc-300">
                        <Upload size={16} />
                        <input 
                          type="file" 
                          accept="audio/*,video/*" 
                          className="hidden" 
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const url = URL.createObjectURL(file);
                              updateConfig(index, 'audioUrl', url);
                            }
                          }} 
                        />
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="border border-zinc-800 rounded-lg overflow-hidden mt-2">
              <button 
                onClick={() => setIsAdvancedSpeechOpen(!isAdvancedSpeechOpen)}
                className="w-full flex items-center justify-between p-3 bg-zinc-900/30 hover:bg-zinc-900/80 text-sm font-medium text-zinc-400 transition-colors"
              >
                <span>Advanced Speech</span>
                {isAdvancedSpeechOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
              
              {isAdvancedSpeechOpen && (
                <div className="p-4 bg-zinc-950 flex flex-col gap-4 border-t border-zinc-800">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-zinc-500">Enable Speech Synthesis</label>
                    <select value={seg.config.speech_synth ? 'true' : 'false'} onChange={(e) => updateConfig(index, 'speech_synth', e.target.value === 'true')} className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500">
                      <option value="false">Off</option>
                      <option value="true">On</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-zinc-500">Voice</label>
                    <input type="text" value={seg.config.speech_voice || 'af_heart'} onChange={(e) => updateConfig(index, 'speech_voice', e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <SliderInput
                      label="Speed"
                      min={0.1}
                      max={5}
                      step={0.1}
                      value={seg.config.speech_speed ?? 1}
                      onChange={(val) => updateConfig(index, 'speech_speed', val)}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function VisualEditor({ segments, onChange }: VisualEditorProps) {
  const updateConfig = (index: number, key: keyof SegmentConfig, value: any) => {
    const newSegments = [...segments];
    newSegments[index] = {
      ...newSegments[index],
      config: {
        ...newSegments[index].config,
        [key]: value
      }
    };
    onChange(newSegments);
  };

  const updateMarkdown = (index: number, markdown: string) => {
    const newSegments = [...segments];
    const parsedContent = parseSegmentContent(markdown);
    newSegments[index] = { 
      ...newSegments[index], 
      rawMarkdown: markdown,
      text: parsedContent.text,
      auxText: parsedContent.auxText,
      media: parsedContent.media,
      wordList: parsedContent.wordList
    };
    onChange(newSegments);
  };

  const addSegment = () => {
    const newSegments = [...segments];
    const lastConfig = segments.length > 0 ? segments[segments.length - 1].config : {
      duration: 10,
      pattern: 'spiral',
      patternType: 'default',
      camera: 'static',
      cameraSpeed: 1.0,
      binaural: 'off',
      metronome: 0,
    };
    const newText = '# New Segment\nAdd your text here.';
    const parsedContent = parseSegmentContent(newText);
    newSegments.push({
      id: `seg-${Date.now()}`,
      config: { ...lastConfig },
      rawMarkdown: newText,
      text: parsedContent.text,
      auxText: parsedContent.auxText,
      media: parsedContent.media,
      wordList: parsedContent.wordList
    });
    onChange(newSegments);
  };

  const removeSegment = (index: number) => {
    const newSegments = [...segments];
    newSegments.splice(index, 1);
    onChange(newSegments);
  };

  const moveSegment = (index: number, dir: number) => {
    if (index + dir < 0 || index + dir >= segments.length) return;
    const newSegments = [...segments];
    const temp = newSegments[index];
    newSegments[index] = newSegments[index + dir];
    newSegments[index + dir] = temp;
    onChange(newSegments);
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      {segments.map((seg, index) => (
        <SegmentEditor 
          key={seg.id}
          seg={seg}
          index={index}
          totalSegments={segments.length}
          updateConfig={updateConfig}
          updateMarkdown={updateMarkdown}
          moveSegment={moveSegment}
          removeSegment={removeSegment}
        />
      ))}

      <button onClick={addSegment} className="flex items-center justify-center gap-2 w-full py-4 border-2 border-dashed border-zinc-800 rounded-xl text-zinc-400 hover:text-emerald-400 hover:border-emerald-500/50 transition-colors">
        <Plus size={20} /> Add Segment
      </button>
    </div>
  );
}
