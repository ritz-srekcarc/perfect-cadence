import React, { useState, useRef, useEffect } from 'react';
import { TimelineSegment, SegmentConfig, parseSegmentContent, MediaItem, PREBUILT_WORDLISTS } from '../timelineParser';
import { Trash2, Plus, ArrowUp, ArrowDown, Upload, ChevronDown, ChevronRight, Sparkles, Loader2, Info, Bold, Italic, Heading1, Heading2, List, ListOrdered, Ear, Timer, Image, Tv, Volume2, Paintbrush, Film, X, Speech, Orbit, Activity, Camera, LayoutGrid, Grid, Layout, Link as LinkIcon, FileUp } from 'lucide-react';
import { transcribeAudio } from '../services/audioAnalysisService';
import ReactQuill, { Quill } from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

// Helper for wordlist display
const toSuperscript = (num: string) => {
  const sups: any = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '.': '·' };
  return num.split('').map(c => sups[c] || c).join('');
};
const toSubscript = (num: string) => {
  const subs: any = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉' };
  return num.split('').map(c => subs[c] || c).join('');
};

// Register custom blots to prevent Quill from stripping them
const Embed = (Quill as any).import('blots/embed');

class WordlistBlot extends Embed {
  static blotName = 'wordlist';
  static tagName = 'span';
  static className = 'wordlist-marker';

  static create(value: any) {
    let node = super.create();
    node.setAttribute('class', 'wordlist-marker');
    node.setAttribute('contenteditable', 'false');
    
    let raw = '';
    let display = '';

    if (typeof value === 'string') {
      raw = value;
      // Parse for display
      const match = raw.match(/!\{([\d.]+),\s*(\d+)\}\(([^)]+)\)/);
      if (match) {
        const [_, interval, count, words] = match;
        const firstWord = words.split(',')[0].trim() || 'word';
        display = `${firstWord}${toSuperscript(interval)}${toSubscript(count)}`;
      }
    } else if (value && typeof value === 'object') {
      raw = value.raw || '';
      display = value.display || '';
    }

    node.setAttribute('data-raw', raw);
    node.setAttribute('data-display', display);
    
    // Styling
    node.style.color = 'transparent';
    node.style.fontSize = '0';
    node.style.position = 'relative';
    node.style.cursor = 'pointer';
    node.style.display = 'inline-block';
    node.style.verticalAlign = 'baseline';
    
    return node;
  }

  static value(node: any) {
    return {
      raw: node.getAttribute('data-raw'),
      display: node.getAttribute('data-display')
    };
  }
}
(Quill as any).register(WordlistBlot);

class ImageBlot extends Embed {
  static blotName = 'image-marker';
  static tagName = 'span';
  static className = 'image-marker';

  static create(value: any) {
    let node = super.create();
    node.setAttribute('class', 'image-marker');
    node.setAttribute('contenteditable', 'false');
    
    let raw = '';
    let display = '';

    if (typeof value === 'string') {
      raw = value;
      const match = raw.match(/!\[(\d+)(?:,(\d+))?\]\((.*?)\)/);
      if (match) {
        const [_, opacity, volume, url] = match;
        const filename = url.split('/').pop() || 'image';
        display = `${filename}${toSuperscript(opacity)}${volume !== undefined ? toSubscript(volume) : ''}`;
      }
    } else if (value && typeof value === 'object') {
      raw = value.raw || '';
      display = value.display || '';
    }

    node.setAttribute('data-raw', raw);
    node.setAttribute('data-display', display);
    
    node.style.color = 'transparent';
    node.style.fontSize = '0';
    node.style.position = 'relative';
    node.style.cursor = 'pointer';
    node.style.display = 'inline-block';
    node.style.verticalAlign = 'baseline';
    
    return node;
  }

  static value(node: any) {
    return {
      raw: node.getAttribute('data-raw'),
      display: node.getAttribute('data-display')
    };
  }
}
(Quill as any).register(ImageBlot);

class VideoBlot extends Embed {
  static blotName = 'video-marker';
  static tagName = 'span';
  static className = 'video-marker';

  static create(value: any) {
    let node = super.create();
    node.setAttribute('class', 'video-marker');
    node.setAttribute('contenteditable', 'false');
    
    let raw = '';
    let display = '';

    if (typeof value === 'string') {
      raw = value;
      const match = raw.match(/!\[(\d+)(?:,(\d+))?\]\((.*?)\)/);
      if (match) {
        const [_, opacity, volume, url] = match;
        const filename = url.split('/').pop() || 'video';
        display = `${filename}${toSuperscript(opacity)}${volume !== undefined ? toSubscript(volume) : ''}`;
      }
    } else if (value && typeof value === 'object') {
      raw = value.raw || '';
      display = value.display || '';
    }

    node.setAttribute('data-raw', raw);
    node.setAttribute('data-display', display);
    
    node.style.color = 'transparent';
    node.style.fontSize = '0';
    node.style.position = 'relative';
    node.style.cursor = 'pointer';
    node.style.display = 'inline-block';
    node.style.verticalAlign = 'baseline';
    
    return node;
  }

  static value(node: any) {
    return {
      raw: node.getAttribute('data-raw'),
      display: node.getAttribute('data-display')
    };
  }
}
(Quill as any).register(VideoBlot);

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
  updateConfigs: (index: number, configs: Partial<SegmentConfig>) => void;
  updateMarkdown: (index: number, markdown: string) => void;
  moveSegment: (index: number, dir: number) => void;
  removeSegment: (index: number) => void;
}

const SliderInput = ({ label, value, min, max, step, onChange, logarithmic = false }: { label: string, value: number, min: number, max: number, step: number, onChange: (val: number) => void, logarithmic?: boolean }) => {
  const getSliderValue = () => {
    if (!logarithmic) return value;
    if (min === 0 && value === 0) return 0;
    
    // For logarithmic, map [min, max] to [0, 1]
    // Use 0.01 as the minimum non-zero value for log scale to avoid huge empty ranges
    const effectiveMin = Math.max(min, 0.01);
    const effectiveValue = Math.max(value, 0.01);
    
    const minLog = Math.log(effectiveMin);
    const maxLog = Math.log(max);
    const valLog = Math.log(effectiveValue);
    return (valLog - minLog) / (maxLog - minLog);
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = parseFloat(e.target.value);
    if (!logarithmic) {
      onChange(rawVal);
    } else {
      if (min === 0 && rawVal === 0) {
        onChange(0);
        return;
      }
      
      const effectiveMin = Math.max(min, 0.01);
      const minLog = Math.log(effectiveMin);
      const maxLog = Math.log(max);
      const valLog = minLog + rawVal * (maxLog - minLog);
      let newVal = Math.exp(valLog);
      
      // Round to step
      newVal = Math.round(newVal / step) * step;
      // Ensure within bounds
      newVal = Math.max(min, Math.min(max, newVal));
      onChange(newVal);
    }
  };

  return (
    <div className="flex flex-col gap-1" onMouseDown={(e) => e.stopPropagation()}>
      <div className="flex justify-between items-center">
        <label className="text-[10px] text-zinc-500">{label}</label>
        <span className="text-[10px] text-zinc-400 font-mono">{typeof value === 'number' ? value.toFixed(step < 1 ? (step < 0.1 ? 2 : 1) : 0) : value}</span>
      </div>
      <input
        type="range"
        min={logarithmic ? 0 : min}
        max={logarithmic ? 1 : max}
        step={logarithmic ? 0.001 : step}
        value={getSliderValue()}
        onChange={handleSliderChange}
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full accent-emerald-500"
      />
    </div>
  );
};

const PaletteManager = ({ palette, onChange }: { palette: string[], onChange: (newPalette: string[]) => void }) => {
  const addColor = () => onChange([...palette, '#ffffff']);
  const removeColor = (index: number) => onChange(palette.filter((_, i) => i !== index));
  const updateColor = (index: number, color: string) => {
    const newPalette = [...palette];
    newPalette[index] = color;
    onChange(newPalette);
  };

  return (
    <div className="flex flex-col gap-2" onMouseDown={(e) => e.stopPropagation()}>
      <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Palette</label>
      <div className="flex flex-wrap gap-2">
        {palette.map((color, i) => (
          <div key={i} className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1">
            <input 
              type="color" 
              value={color} 
              onChange={(e) => updateColor(i, e.target.value)}
              className="w-6 h-6 bg-transparent border-none cursor-pointer p-0"
            />
            <button 
              onClick={() => removeColor(i)}
              className="text-zinc-500 hover:text-red-400 transition-colors"
              disabled={palette.length <= 1}
            >
              <X size={12} />
            </button>
          </div>
        ))}
        <button 
          onClick={addColor}
          className="w-8 h-8 flex items-center justify-center bg-zinc-900 border border-zinc-800 border-dashed rounded-lg text-zinc-500 hover:text-emerald-400 hover:border-emerald-500/50 transition-all"
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
};

// Simple markdown-to-html for Quill
const toHtml = (md: string) => {
  if (!md) return '<p><br></p>';
  
  let lines = md.split('\n');
  let htmlLines = lines.map(line => {
    let processed = line;
    
    // Escape HTML first
    processed = processed.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    
    // Bold
    processed = processed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Italic
    processed = processed.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // Media
    processed = processed.replace(/!\[(\d+)(?:,(\d+))?\]\((.*?)\)/g, (match, opacity, volume, url) => {
      const filename = url.split('/').pop() || (volume !== undefined ? 'video' : 'image');
      const display = `${filename}${toSuperscript(opacity)}${volume !== undefined ? toSubscript(volume) : ''}`;
      const escapedDisplay = display.replace(/"/g, '&quot;');
      const escapedRaw = match.replace(/"/g, '&quot;');
      const className = volume !== undefined ? 'video-marker' : 'image-marker';
      return `<span class="${className}" data-display="${escapedDisplay}" data-raw="${escapedRaw}" contenteditable="false" style="color: transparent; font-size: 0; position: relative; cursor: pointer; display: inline-block; vertical-align: baseline;"></span>`;
    });
    // Wordlist
    processed = processed.replace(/!\{([\d.]+),\s*(\d+)\}\(([^)]+)\)/g, (match, interval, count, words) => {
      const firstWord = words.split(',')[0].trim() || 'word';
      const display = `${firstWord}${toSuperscript(interval)}${toSubscript(count)}`;
      const escapedDisplay = display.replace(/"/g, '&quot;');
      const escapedRaw = match.replace(/"/g, '&quot;');
      return `<span class="wordlist-marker" data-display="${escapedDisplay}" data-raw="${escapedRaw}" contenteditable="false" style="color: transparent; font-size: 0; position: relative; cursor: pointer; display: inline-block; vertical-align: baseline;"></span>`;
    });

    // Block elements - don't wrap these in <p>
    if (processed.startsWith('# ')) {
      return `<h1>${processed.substring(2)}</h1>`;
    }
    if (processed.startsWith('&gt; ')) {
      return `<blockquote>${processed.substring(5)}</blockquote>`;
    }
    
    return processed.trim() ? `<p>${processed}</p>` : '<p><br></p>';
  });
  
  return htmlLines.join('');
};

// Simple html-to-markdown from Quill
const fromHtml = (html: string) => {
  if (!html || html === '<p><br></p>') return '';
  
  let md = html;

  // Wordlists and Media - extract from data-raw
  md = md.replace(/<span[^>]*class="[^"]*(?:wordlist|image|video)-marker[^"]*"[^>]*>.*?<\/span>/g, (match) => {
    const rawMatch = match.match(/data-raw="([^"]+)"/);
    if (rawMatch) {
      return rawMatch[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&');
    }
    return '';
  });

  // Replace non-breaking spaces with regular spaces
  md = md.replace(/&nbsp;/g, ' ');
  md = md.replace(/\u00A0/g, ' ');

  // Convert block elements first
  md = md.replace(/<h1[^>]*>(.*?)<\/h1>/g, '# $1\n');
  md = md.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/g, '> $1\n');
  
  // Inline formatting
  md = md.replace(/<strong[^>]*>(.*?)<\/strong>/g, '**$1**');
  md = md.replace(/<b[^>]*>(.*?)<\/b>/g, '**$1**');
  md = md.replace(/<em[^>]*>(.*?)<\/em>/g, '*$1*');
  md = md.replace(/<i[^>]*>(.*?)<\/i>/g, '*$1*');
  
  // Paragraphs and breaks
  md = md.replace(/<p[^>]*>(.*?)<\/p>/g, '$1\n');
  md = md.replace(/<br\s*\/?>/g, '\n');
  
  // Strip remaining tags
  md = md.replace(/<[^>]+>/g, '');
  
  // Unescape HTML entities
  md = md.replace(/&lt;/g, '<');
  md = md.replace(/&gt;/g, '>');
  md = md.replace(/&amp;/g, '&');
  
  // Clean up multiple newlines that might have been introduced
  return md.replace(/\n{3,}/g, '\n\n').trim();
};

const QuillComponent = ReactQuill as any;

const RichTextEditor = ({ markdown, onChange, onOpenMediaBubble, onOpenWordlistBubble, onOpenPaintbrush, onOpenFilm, readOnly = false }: { 
  markdown: string, 
  onChange: (md: string) => void,
  onOpenMediaBubble: (type: 'image' | 'video', index: number) => void,
  onOpenWordlistBubble: (index: number) => void,
  onOpenPaintbrush: (isAux: boolean) => void,
  onOpenFilm: (isAux: boolean) => void,
  readOnly?: boolean
}) => {
  const quillRef = useRef<ReactQuill>(null);
  const [toolbarId] = useState(() => `toolbar-${Math.random().toString(36).substr(2, 9)}`);
  const [activeFormats, setActiveFormats] = useState<Record<string, any>>({});

  const [internalHtml, setInternalHtml] = useState(() => toHtml(markdown));
  const lastEmittedMd = useRef(markdown);

  useEffect(() => {
    if (markdown !== lastEmittedMd.current) {
      setInternalHtml(toHtml(markdown));
      lastEmittedMd.current = markdown;
    }
  }, [markdown]);

  useEffect(() => {
    if (quillRef.current) {
      const quill = quillRef.current.getEditor();
      const handleEditorChange = () => {
        setActiveFormats(quill.getFormat());
      };
      
      const handleEditorClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        const wordlistMarker = target.closest('.wordlist-marker');
        if (wordlistMarker) {
          const markers = Array.from(quill.root.querySelectorAll('.wordlist-marker'));
          const index = markers.indexOf(wordlistMarker);
          if (index !== -1) onOpenWordlistBubble(index);
          return;
        }

        const imageMarker = target.closest('.image-marker');
        if (imageMarker) {
          const markers = Array.from(quill.root.querySelectorAll('.image-marker'));
          const index = markers.indexOf(imageMarker);
          if (index !== -1) onOpenMediaBubble('image', index);
          return;
        }

        const videoMarker = target.closest('.video-marker');
        if (videoMarker) {
          const markers = Array.from(quill.root.querySelectorAll('.video-marker'));
          const index = markers.indexOf(videoMarker);
          if (index !== -1) onOpenMediaBubble('video', index);
          return;
        }
      };

      quill.on('editor-change', handleEditorChange);
      quill.root.addEventListener('click', handleEditorClick);
      
      return () => {
        quill.off('editor-change', handleEditorChange);
        quill.root.removeEventListener('click', handleEditorClick);
      };
    }
  }, [onOpenWordlistBubble]);

  const modules = React.useMemo(() => ({
    toolbar: `#${toolbarId}`
  }), [toolbarId]);

  const handleFormat = (format: string, value: any = true) => {
    if (quillRef.current) {
      const quill = quillRef.current.getEditor();
      const currentFormat = quill.getFormat();
      if (currentFormat[format]) {
        quill.format(format, false);
      } else {
        quill.format(format, value);
      }
      setActiveFormats(quill.getFormat());
    }
  };

  const handleInsert = (type: 'image' | 'video' | 'wordlist') => {
    if (!quillRef.current) return;
    const quill = quillRef.current.getEditor();
    let range = quill.getSelection();
    
    if (!range) {
      range = { index: 0, length: 0 };
      quill.setSelection(0, 0);
    }

    const text = quill.getText();
    const index = range.index;

    const textBefore = text.substring(0, index);
    const textAfter = text.substring(index);
    
    const lastBang = textBefore.lastIndexOf('!');
    const lastCloseParenBefore = textBefore.lastIndexOf(')');
    
    const nextCloseParen = textAfter.indexOf(')');
    const nextBangAfter = textAfter.indexOf('!');
    
    let isInsideTag = false;
    let tagContent = '';
    let tagEndIndex = -1;

    if (lastBang !== -1 && nextCloseParen !== -1) {
      // Ensure there are no closing parens between the last bang and the cursor
      // and no new bangs between the cursor and the next closing paren
      if (lastCloseParenBefore < lastBang && (nextBangAfter === -1 || nextBangAfter > nextCloseParen)) {
        const between = text.substring(lastBang, index + nextCloseParen + 1);
        if (between.startsWith('![') || between.startsWith('!{')) {
          isInsideTag = true;
          tagContent = between;
          tagEndIndex = lastBang + between.length;
        }
      }
    }

    if (isInsideTag) {
      const isMedia = tagContent.startsWith('![');
      const isWordlist = tagContent.startsWith('!{');
      
      const isAppropriate = (type === 'image' || type === 'video') ? isMedia : (type === 'wordlist' ? isWordlist : false);

      if (isAppropriate) {
        // Find index of this tag
        const textBeforeTag = text.substring(0, lastBang);
        if (type === 'image' || type === 'video') {
          const mediaIndex = (textBeforeTag.match(/!\[(\d+)(?:,(\d+))?\]\((.*?)\)/g) || []).length;
          onOpenMediaBubble(type, mediaIndex);
        } else {
          const wordlistIndex = (textBeforeTag.match(/!\{([\d.]+),\s*(\d+)\}\(([^)]+)\)/g) || []).length;
          onOpenWordlistBubble(wordlistIndex);
        }
        return;
      } else {
        quill.setSelection(tagEndIndex, 0);
        range = { index: tagEndIndex, length: 0 };
      }
    }

    const insertStr = type === 'wordlist' ? '!{1, 1}(word1,word2)' : (type === 'video' ? '![100,100]()' : '![100]()');
    if (type === 'wordlist') {
      quill.insertEmbed(range.index, 'wordlist', insertStr, 'user');
      
      // Calculate index for the newly inserted wordlist
      let wordlistIndex = 0;
      const delta = quill.getContents(0, range.index + 1);
      delta.forEach((op: any) => {
        if (op.insert && typeof op.insert === 'object' && op.insert.wordlist) {
          wordlistIndex++;
        }
      });
      onOpenWordlistBubble(wordlistIndex - 1);
    } else if (type === 'image') {
      quill.insertEmbed(range.index, 'image-marker', insertStr, 'user');
      let imageIndex = 0;
      const delta = quill.getContents(0, range.index + 1);
      delta.forEach((op: any) => {
        if (op.insert && typeof op.insert === 'object' && op.insert['image-marker']) {
          imageIndex++;
        }
      });
      onOpenMediaBubble('image', imageIndex - 1);
    } else if (type === 'video') {
      quill.insertEmbed(range.index, 'video-marker', insertStr, 'user');
      let videoIndex = 0;
      const delta = quill.getContents(0, range.index + 1);
      delta.forEach((op: any) => {
        if (op.insert && typeof op.insert === 'object' && op.insert['video-marker']) {
          videoIndex++;
        }
      });
      onOpenMediaBubble('video', videoIndex - 1);
    }
    
    // Only set selection if we're not opening a bubble that needs focus
    if (type !== 'image' && type !== 'video' && type !== 'wordlist') {
      quill.setSelection(range.index + insertStr.length, 0);
    }
  };

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

  return (
    <div className="rich-text-editor bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden">
      <div id={toolbarId} className="ql-toolbar ql-snow flex items-center gap-1 flex-nowrap overflow-x-auto scrollbar-hide">
        <span className="flex items-center gap-1 shrink-0">
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => handleFormat('header', 1)} className={`!w-auto !h-auto p-1 rounded flex items-center justify-center shrink-0 ${activeFormats.header ? 'text-emerald-400 bg-zinc-800' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`} title="Heading 1">
            <Heading1 size={16} />
          </button>
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => handleFormat('bold')} className={`!w-auto !h-auto p-1 rounded flex items-center justify-center shrink-0 ${activeFormats.bold ? 'text-emerald-400 bg-zinc-800' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`} title="Bold">
            <Bold size={16} />
          </button>
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => handleFormat('italic')} className={`!w-auto !h-auto p-1 rounded flex items-center justify-center shrink-0 ${activeFormats.italic ? 'text-emerald-400 bg-zinc-800' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`} title="Italic">
            <Italic size={16} />
          </button>
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => handleFormat('blockquote')} className={`!w-auto !h-auto p-1 rounded flex items-center justify-center shrink-0 ${activeFormats.blockquote ? 'text-emerald-400 bg-zinc-800' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`} title="Blockquote">
            <LayoutGrid size={16} />
          </button>
          
          <div className="w-px h-4 bg-zinc-800 mx-1"></div>
          
          <button onMouseDown={(e) => e.preventDefault()} onClick={handlePaintbrushClick} data-bubble-toggle="true" className="!w-auto !h-auto p-1 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded flex items-center justify-center shrink-0" title="Style Settings">
            <Paintbrush size={16} />
          </button>
          <button onMouseDown={(e) => e.preventDefault()} onClick={handleFilmClick} data-bubble-toggle="true" className="!w-auto !h-auto p-1 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded flex items-center justify-center shrink-0" title="Animation Settings">
            <Film size={16} />
          </button>
        </span>
        <span className="flex items-center gap-1 border-l border-zinc-800 pl-2 ml-1 shrink-0">
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => handleInsert('image')} data-bubble-toggle="true" className="!w-auto !h-auto p-1 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded flex items-center justify-center shrink-0" title="Insert Image">
            <Image size={16} />
          </button>
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => handleInsert('video')} data-bubble-toggle="true" className="!w-auto !h-auto p-1 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded flex items-center justify-center shrink-0" title="Insert Video">
            <Tv size={16} />
          </button>
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => handleInsert('wordlist')} data-bubble-toggle="true" className="!w-auto !h-auto p-1 text-emerald-400 hover:text-emerald-300 hover:bg-zinc-800 rounded flex items-center justify-center shrink-0" title="Insert Wordlist">
            <Sparkles size={16} />
          </button>
        </span>
      </div>
      <div 
        className="relative"
        onFocusCapture={(e) => {
          if (readOnly) {
            e.stopPropagation();
            if (quillRef.current) {
              quillRef.current.getEditor().blur();
            }
          }
        }}
      >
        <QuillComponent 
          ref={quillRef}
          theme="snow"
          value={internalHtml}
          onChange={(content: string, delta: any, source: string) => {
            setInternalHtml(content);
            if (source === 'user') {
              const newMd = fromHtml(content);
              if (newMd !== lastEmittedMd.current) {
                lastEmittedMd.current = newMd;
                onChange(newMd);
              }
            }
          }}
          modules={modules}
          formats={[
            'header', 'bold', 'italic', 'blockquote', 'list', 'indent', 'link', 'image', 'video',
            'wordlist', 'image-marker', 'video-marker'
          ]}
          readOnly={readOnly}
          className="text-zinc-200"
        />
        {readOnly && (
          <div 
            className="absolute inset-0 z-10 cursor-default" 
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={(e) => e.stopPropagation()}
          />
        )}
      </div>
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
        .ql-editor .wordlist-marker,
        .ql-editor .image-marker,
        .ql-editor .video-marker { 
          display: inline-block; 
          vertical-align: baseline; 
          position: relative; 
          color: transparent !important;
          font-size: 0 !important;
          cursor: pointer;
          user-select: none;
          margin: 0 2px;
        }
        .ql-editor .wordlist-marker::after,
        .ql-editor .image-marker::after,
        .ql-editor .video-marker::after { 
          content: attr(data-display); 
          font-size: 13px; 
          line-height: 1.2; 
          color: #10b981; 
          background: rgba(16, 185, 129, 0.15);
          padding: 0 4px;
          border-radius: 4px;
          border: 1px solid rgba(16, 185, 129, 0.3);
          display: inline-block; 
          vertical-align: middle; 
          pointer-events: none; 
          visibility: visible;
        }
        .ql-editor .image-marker::after {
          color: #60a5fa;
          background: rgba(96, 165, 250, 0.15);
          border-color: rgba(96, 165, 250, 0.3);
        }
        .ql-editor .video-marker::after {
          color: #f472b6;
          background: rgba(244, 114, 182, 0.15);
          border-color: rgba(244, 114, 182, 0.3);
        }
        .ql-editor .wordlist-marker:hover::after,
        .ql-editor .image-marker:hover::after,
        .ql-editor .video-marker:hover::after {
          background: rgba(16, 185, 129, 0.25);
          border-color: rgba(16, 185, 129, 0.5);
        }
        .ql-editor .image-marker:hover::after {
          background: rgba(96, 165, 250, 0.25);
          border-color: rgba(96, 165, 250, 0.5);
        }
        .ql-editor .video-marker:hover::after {
          background: rgba(244, 114, 182, 0.25);
          border-color: rgba(244, 114, 182, 0.5);
        }
      `}</style>
    </div>
  );
};

const PREDEFINED_WORDLISTS = [
  { name: 'Custom', words: '' },
  { name: 'Relaxation', words: 'relax,breathe,calm,peace,stillness,quiet,serenity,release' },
  { name: 'Focus', words: 'focus,concentrate,clarity,sharp,direct,intent,presence,alert' },
  { name: 'Sleep', words: 'sleep,dream,rest,slumber,drift,soft,heavy,night' },
  { name: 'Energy', words: 'energy,vitality,power,strength,awake,bright,vibrant,flow' },
  { name: 'Gratitude', words: 'gratitude,thanks,blessing,love,kindness,joy,heart,open' }
];

const CompactUrlPicker = ({ url, onChange, placeholder = "URL", autoFocus = false }: { url: string, onChange: (url: string) => void, placeholder?: string, autoFocus?: boolean }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const objectUrl = URL.createObjectURL(file);
      onChange(objectUrl);
    }
  };

  return (
    <div className="flex gap-2 items-center" onMouseDown={(e) => e.stopPropagation()}>
      <div className="relative flex-1">
        <input 
          type="text" 
          autoFocus={autoFocus}
          placeholder={placeholder}
          value={url} 
          onChange={(e) => onChange(e.target.value)} 
          onMouseDown={(e) => e.stopPropagation()}
          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 pr-8 min-w-0" 
        />
        <LinkIcon size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500" />
      </div>
      <button
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onClick={() => fileInputRef.current?.click()}
        className="p-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-zinc-400 transition-colors shrink-0"
        title="Upload file"
      >
        <FileUp size={14} />
      </button>
      <input 
        type="file" 
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden" 
        accept="image/*,video/*" 
      />
    </div>
  );
};

/**
 * SegmentEditor
 * 
 * A sub-component for editing a single segment within the VisualEditor.
 */
function SegmentEditor({ seg, index, totalSegments, updateConfig, updateConfigs, updateMarkdown, moveSegment, removeSegment }: SegmentEditorProps) {
  const getValidPatternType = (type: string | undefined) => {
    if (!type) return 'fascinator';
    if (['default', 'hypnotic', 'double', 'sacred_geometry'].includes(type)) return 'fascinator';
    if (['sphere', 'galaxy'].includes(type)) return 'topology';
    if (['breathing'].includes(type)) return 'cloud';
    if (['cylinder', 'infinite'].includes(type)) return 'repetition';
    return type;
  };

  const getAvailablePatterns = (type: string | undefined) => {
    const valid: Record<string, string[]> = {
      fascinator: ['mandala', 'flame', 'dot', 'flat spiral', 'thicc spiral', 'pendulum', 'wheel', 'dial', 'clock', 'ring', 'kaleido'],
      repetition: ['grid', 'march', 'helix', 'spiral', 'vortex', 'sphere', 'cube', 'polygon'],
      cloud: ['particle', 'nebula', 'smoke', 'fluid', 'swarm', 'constellation', 'bubbles'],
      cluster: ['disordered', 'float', 'orbit', 'pulse', 'vortex'],
      topology: ['orb', 'tunnel', 'wave', 'nautilus spiral', 'cone spiral', 'saddle', 'plane', 'random voxel surface', 'random curved surface', 'galaxy']
    };
    return valid[getValidPatternType(type)] || valid.fascinator;
  };

  const getValidPattern = (type: string | undefined, current: string | undefined) => {
    const available = getAvailablePatterns(type);
    if (current && available.includes(current)) return current;
    return available[0] || 'flat spiral';
  };

  const [activeBubble, setActiveBubble] = useState<{ 
    type: 'style' | 'animation' | 'speech' | 'binaural' | 'audio' | 'metronome' | 'pattern' | 'camera' | 'anim_config' | 'image' | 'video' | 'wordlist', 
    isAux?: boolean,
    index?: number
  } | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribeProgress, setTranscribeProgress] = useState('');
  const bubbleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeBubble) return;

    // Use native listener on the bubble to stop propagation to document
    // This is more reliable for preventing handleClickOutside from firing
    const bubble = bubbleRef.current;

    const handleClickOutside = (event: MouseEvent) => {
      if (bubbleRef.current && !bubbleRef.current.contains(event.target as Node)) {
        const target = event.target as HTMLElement;
        const isToggleButton = target.closest('button')?.hasAttribute('data-bubble-toggle');
        const isInsideEditor = target.closest('.rich-text-editor');
        const isInsideBubble = target.closest('[data-bubble-container="true"]');
        
        if (!isToggleButton && !isInsideEditor && !isInsideBubble) {
          setActiveBubble(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [activeBubble]);

  const parsed = parseSegmentContent(seg.rawMarkdown);
  const media = parsed.media;

  const replaceMediaInMarkdown = (markdown: string, mediaIndex: number, newMediaItem: MediaItem | null) => {
    const mediaRegex = /!\[(\d+)(?:,(\d+))?\]\((.*?)\)/g;
    let currentIndex = 0;
    
    return markdown.replace(mediaRegex, (fullMatch, opacity, volume, url) => {
      if (currentIndex === mediaIndex) {
        currentIndex++;
        if (newMediaItem === null) return '';
        return `![${Math.round(newMediaItem.opacity * 100)}${newMediaItem.volume !== undefined ? ',' + Math.round(newMediaItem.volume * 100) : ''}](${newMediaItem.url})`;
      }
      currentIndex++;
      return fullMatch;
    });
  };

  const handleMediaChange = (mediaIndex: number, field: keyof MediaItem, value: any) => {
    const newMedia = [...media];
    newMedia[mediaIndex] = { ...newMedia[mediaIndex], [field]: value };
    updateMarkdown(index, replaceMediaInMarkdown(seg.rawMarkdown, mediaIndex, newMedia[mediaIndex]));
  };

  const addMedia = (type: 'image' | 'video') => {
    const newStr = type === 'video' ? '![100,100]()' : '![100]()';
    updateMarkdown(index, seg.rawMarkdown + `\n\n${newStr}`);
  };

  const removeMedia = (mediaIndex: number) => {
    updateMarkdown(index, replaceMediaInMarkdown(seg.rawMarkdown, mediaIndex, null));
  };

  const wordlistRegex = /!\{\s*([\d.]+)\s*,\s*(\d+)\s*\}\(([^)]+)\)/g;
  const wordlists: { interval: number; count: number; words: string }[] = [];
  let wlMatch;
  while ((wlMatch = wordlistRegex.exec(seg.rawMarkdown)) !== null) {
    wordlists.push({
      interval: parseFloat(wlMatch[1]),
      count: parseInt(wlMatch[2]),
      words: wlMatch[3]
    });
  }

  const replaceWordlistInMarkdown = (markdown: string, wlIndex: number, newWlItem: { interval: number; count: number; words: string } | null) => {
    const wlRegex = /!\{([\d.]+),\s*(\d+)\}\(([^)]+)\)/g;
    let currentIndex = 0;
    
    return markdown.replace(wlRegex, (fullMatch, interval, count, words) => {
      if (currentIndex === wlIndex) {
        currentIndex++;
        if (newWlItem === null) return '';
        return `!{${newWlItem.interval},${newWlItem.count}}(${newWlItem.words})`;
      }
      currentIndex++;
      return fullMatch;
    });
  };

  const handleWordlistChange = (wlIndex: number, field: string, value: any) => {
    const newWl = [...wordlists];
    newWl[wlIndex] = { ...newWl[wlIndex], [field]: value };
    updateMarkdown(index, replaceWordlistInMarkdown(seg.rawMarkdown, wlIndex, newWl[wlIndex]));
  };

  const removeWordlist = (wlIndex: number) => {
    updateMarkdown(index, replaceWordlistInMarkdown(seg.rawMarkdown, wlIndex, null));
    setActiveBubble(null);
  };

  const handleTranscribe = async () => {
    if (!seg.config.audioUrl) return;
    setIsTranscribing(true);
    setTranscribeProgress('Initializing...');
    try {
      const text = await transcribeAudio(seg.config.audioUrl, setTranscribeProgress);
      // Append transcribed text to rawMarkdown
      updateMarkdown(index, seg.rawMarkdown + '\n' + text);
    } finally {
      setIsTranscribing(false);
      setTranscribeProgress('');
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
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setActiveBubble(activeBubble?.type === 'audio' ? null : { type: 'audio' })}
              data-bubble-toggle="true"
              className={`p-1 rounded transition-colors ${activeBubble?.type === 'audio' ? 'text-emerald-400 bg-emerald-500/20' : 'text-zinc-400 hover:text-emerald-400 bg-zinc-900'}`}
              title="Audio Options"
            >
              <Volume2 size={12} />
            </button>
            <button 
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setActiveBubble(activeBubble?.type === 'binaural' ? null : { type: 'binaural' })}
              data-bubble-toggle="true"
              className={`p-1 rounded transition-colors ${activeBubble?.type === 'binaural' ? 'text-emerald-400 bg-emerald-500/20' : 'text-zinc-400 hover:text-emerald-400 bg-zinc-900'}`}
              title="Binaural Options"
            >
              <Ear size={12} />
            </button>
            <button 
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setActiveBubble(activeBubble?.type === 'metronome' ? null : { type: 'metronome' })}
              data-bubble-toggle="true"
              className={`p-1 rounded transition-colors ${activeBubble?.type === 'metronome' ? 'text-emerald-400 bg-emerald-500/20' : 'text-zinc-400 hover:text-emerald-400 bg-zinc-900'}`}
              title="Metronome Options"
            >
              <Timer size={12} />
            </button>
            <button 
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setActiveBubble(activeBubble?.type === 'speech' ? null : { type: 'speech' })}
              data-bubble-toggle="true"
              className={`p-1 rounded transition-colors ${activeBubble?.type === 'speech' ? 'text-emerald-400 bg-emerald-500/20' : 'text-zinc-400 hover:text-emerald-400 bg-zinc-900'}`}
              title="Speech Synthesis"
            >
              <Speech size={12} />
            </button>
          </div>
        </div>
        <div className="flex gap-1 transition-opacity">
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => moveSegment(index, -1)} disabled={index === 0} className="p-1 text-zinc-400 hover:text-white disabled:opacity-30"><ArrowUp size={16}/></button>
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => moveSegment(index, 1)} disabled={index === totalSegments - 1} className="p-1 text-zinc-400 hover:text-white disabled:opacity-30"><ArrowDown size={16}/></button>
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => removeSegment(index)} className="p-1 text-red-400 hover:text-red-300 ml-2"><Trash2 size={16}/></button>
        </div>
      </div>

      <div className="flex flex-col gap-2 relative">
        <RichTextEditor 
          markdown={seg.rawMarkdown}
          readOnly={!!activeBubble}
          onChange={(md) => updateMarkdown(index, md)}
          onOpenMediaBubble={(type, mediaIndex) => setActiveBubble(activeBubble?.type === type && activeBubble.index === mediaIndex ? null : { type, index: mediaIndex })}
          onOpenWordlistBubble={(wordlistIndex) => setActiveBubble(activeBubble?.type === 'wordlist' && activeBubble.index === wordlistIndex ? null : { type: 'wordlist', index: wordlistIndex })}
          onOpenPaintbrush={(isAux) => setActiveBubble(activeBubble?.type === 'style' && activeBubble.isAux === isAux ? null : { type: 'style', isAux })}
          onOpenFilm={(isAux) => setActiveBubble(activeBubble?.type === 'animation' && activeBubble.isAux === isAux ? null : { type: 'animation', isAux })}
        />

        {activeBubble && (
          <div 
            ref={bubbleRef}
            data-bubble-container="true"
            className="absolute top-12 right-0 z-50 w-96 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl p-4 animate-in fade-in zoom-in duration-200"
          >
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                {activeBubble.type === 'style' ? <Paintbrush size={14} /> : 
                 activeBubble.type === 'animation' ? <Film size={14} /> :
                 activeBubble.type === 'speech' ? <Speech size={14} /> :
                 activeBubble.type === 'binaural' ? <Ear size={14} /> :
                 activeBubble.type === 'audio' ? <Volume2 size={14} /> :
                 activeBubble.type === 'pattern' ? <Orbit size={14} /> :
                 activeBubble.type === 'anim_config' ? <Activity size={14} /> :
                 activeBubble.type === 'camera' ? <Camera size={14} /> :
                 activeBubble.type === 'image' ? <Image size={14} /> :
                 activeBubble.type === 'video' ? <Tv size={14} /> :
                 activeBubble.type === 'wordlist' ? <Sparkles size={14} /> :
                 <Timer size={14} />}
                {activeBubble.isAux !== undefined ? (activeBubble.isAux ? 'Aux ' : 'Text ') : ''}
                {activeBubble.type === 'style' ? 'Style' : 
                 activeBubble.type === 'animation' ? 'Animation' :
                 activeBubble.type === 'speech' ? 'Speech' :
                 activeBubble.type === 'binaural' ? 'Binaural' :
                 activeBubble.type === 'audio' ? 'Audio' :
                 activeBubble.type === 'pattern' ? 'Pattern' :
                 activeBubble.type === 'anim_config' ? 'Anim Config' :
                 activeBubble.type === 'camera' ? 'Camera' :
                 activeBubble.type === 'image' ? 'Image' :
                 activeBubble.type === 'video' ? 'Video' :
                 activeBubble.type === 'wordlist' ? 'Wordlist' :
                 'Metronome'}
              </h4>
              <button 
                onMouseDown={(e) => {
                  e.preventDefault();
                }} 
                onClick={() => setActiveBubble(null)} 
                className="p-1 text-zinc-500 hover:text-white transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-3">
              {activeBubble.type === 'style' ? (
                <>
                  <div className="flex flex-col gap-1 col-span-2">
                    <label className="text-[10px] text-zinc-500 uppercase font-bold">Font</label>
                    <select 
                      value={(activeBubble.isAux ? seg.config.auxFont : seg.config.textFont) || 'sans-serif'} 
                      onChange={(e) => updateConfig(index, activeBubble.isAux ? 'auxFont' : 'textFont', e.target.value)} 
                      onMouseDown={(e) => e.stopPropagation()}
                      className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-full"
                    >
                      <option value="sans-serif">Sans-Serif</option>
                      <option value="serif">Serif</option>
                      <option value="monospace">Monospace</option>
                      <option value="cursive">Cursive</option>
                      <option value="fantasy">Fantasy</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <SliderInput
                      label="Size"
                      min={10} max={300} step={1}
                      value={(activeBubble.isAux ? seg.config.auxSize : seg.config.textSize) ?? 100}
                      onChange={(val) => updateConfig(index, activeBubble.isAux ? 'auxSize' : 'textSize', val)}
                    />
                  </div>
                  <div className="flex flex-col gap-1 col-span-2">
                    <label className="text-[10px] text-zinc-500 uppercase font-bold">Outline</label>
                    <select 
                      value={(activeBubble.isAux ? seg.config.auxOutlineType : seg.config.textOutlineType) || 'none'} 
                      onChange={(e) => updateConfig(index, activeBubble.isAux ? 'auxOutlineType' : 'textOutlineType', e.target.value)} 
                      onMouseDown={(e) => e.stopPropagation()}
                      className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-full"
                    >
                      <option value="none">None</option>
                      <option value="rainbow">Rainbow</option>
                      <option value="solid">Solid</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <SliderInput
                      label="Outline Width"
                      min={0} max={50} step={1}
                      value={(activeBubble.isAux ? seg.config.auxOutlineWidth : seg.config.textOutlineWidth) ?? 8}
                      onChange={(val) => updateConfig(index, activeBubble.isAux ? 'auxOutlineWidth' : 'textOutlineWidth', val)}
                    />
                  </div>
                  <div className="flex flex-col gap-1 col-span-2">
                    <label className="text-[10px] text-zinc-500 uppercase font-bold">Color</label>
                    <input 
                      type="color" 
                      value={(activeBubble.isAux ? seg.config.auxColor : seg.config.textColor) || '#ffffff'} 
                      onChange={(e) => updateConfig(index, activeBubble.isAux ? 'auxColor' : 'textColor', e.target.value)} 
                      onMouseDown={(e) => e.stopPropagation()}
                      className="bg-zinc-950 border border-zinc-800 rounded-lg px-1 py-0.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 h-8 w-full" 
                    />
                  </div>
                  <div className="flex flex-col gap-1 col-span-2">
                    <label className="text-[10px] text-zinc-500 uppercase font-bold">Shading</label>
                    <select 
                      value={(activeBubble.isAux ? seg.config.auxShading : seg.config.textShading) ? 'true' : 'false'} 
                      onChange={(e) => updateConfig(index, activeBubble.isAux ? 'auxShading' : 'textShading', e.target.value === 'true')} 
                      onMouseDown={(e) => e.stopPropagation()}
                      className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-full"
                    >
                      <option value="false">Off</option>
                      <option value="true">On</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1 col-span-2">
                    <label className="text-[10px] text-zinc-500 uppercase font-bold">Backdrop</label>
                    <select 
                      value={(activeBubble.isAux ? seg.config.auxBackdrop : seg.config.textBackdrop) ? 'true' : 'false'} 
                      onChange={(e) => updateConfig(index, activeBubble.isAux ? 'auxBackdrop' : 'textBackdrop', e.target.value === 'true')} 
                      onMouseDown={(e) => e.stopPropagation()}
                      className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-full"
                    >
                      <option value="false">Off</option>
                      <option value="true">On</option>
                    </select>
                  </div>
                  {!activeBubble.isAux && (
                    <div className="flex flex-col gap-1 col-span-2">
                      <label className="text-[10px] text-zinc-500 uppercase font-bold">Pattern</label>
                      <select 
                        value={seg.config.textDisplayPattern || 'center'} 
                        onChange={(e) => updateConfig(index, 'textDisplayPattern', e.target.value)} 
                        onMouseDown={(e) => e.stopPropagation()}
                        className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-full"
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
              ) : activeBubble.type === 'animation' ? (
                <>
                  <div className="flex flex-col gap-1 col-span-2">
                    <label className="text-[10px] text-zinc-500 uppercase font-bold">Animation Type</label>
                    <select 
                      value={(activeBubble.isAux ? seg.config.auxAnimType : seg.config.textAnimType) || 'none'} 
                      onChange={(e) => updateConfig(index, activeBubble.isAux ? 'auxAnimType' : 'textAnimType', e.target.value)} 
                      onMouseDown={(e) => e.stopPropagation()}
                      className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-full"
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
                  <div className="col-span-2">
                    <SliderInput
                      label="Distance"
                      min={-50} max={50} step={1}
                      value={(activeBubble.isAux ? seg.config.auxDistance : seg.config.textDistance) ?? (activeBubble.isAux ? 10 : -5)}
                      onChange={(val) => updateConfig(index, activeBubble.isAux ? 'auxDistance' : 'textDistance', val)}
                    />
                  </div>
                  <div className="col-span-2">
                    <SliderInput
                      label="Speed"
                      min={0} max={5} step={0.1}
                      value={(activeBubble.isAux ? seg.config.auxAnimSpeed : seg.config.textAnimSpeed) ?? 1.0}
                      onChange={(val) => updateConfig(index, activeBubble.isAux ? 'auxAnimSpeed' : 'textAnimSpeed', val)}
                    />
                  </div>
                  <div className="col-span-2">
                    <SliderInput
                      label="Intensity"
                      min={0} max={5} step={0.1}
                      value={(activeBubble.isAux ? seg.config.auxAnimIntensity : seg.config.textAnimIntensity) ?? 1.0}
                      onChange={(val) => updateConfig(index, activeBubble.isAux ? 'auxAnimIntensity' : 'textAnimIntensity', val)}
                    />
                  </div>
                </>
              ) : activeBubble.type === 'speech' ? (
                <>
                  <div className="flex flex-col gap-1 col-span-2">
                    <label className="text-[10px] text-zinc-500 uppercase font-bold">Enable Speech Synthesis</label>
                    <select value={seg.config.speech_synth ? 'true' : 'false'} onChange={(e) => updateConfig(index, 'speech_synth', e.target.value === 'true')} onMouseDown={(e) => e.stopPropagation()} className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500">
                      <option value="false">Off</option>
                      <option value="true">On</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1 col-span-2">
                    <label className="text-[10px] text-zinc-500 uppercase font-bold">Voice</label>
                    <input type="text" value={seg.config.speech_voice || 'af_heart'} onChange={(e) => updateConfig(index, 'speech_voice', e.target.value)} onMouseDown={(e) => e.stopPropagation()} className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-full" />
                  </div>
                  <div className="col-span-2">
                    <SliderInput
                      label="Speed"
                      min={0.1}
                      max={5}
                      step={0.1}
                      value={seg.config.speech_speed ?? 1}
                      onChange={(val) => updateConfig(index, 'speech_speed', val)}
                    />
                  </div>
                </>
              ) : activeBubble.type === 'binaural' ? (
                <>
                  <div className="flex flex-col gap-1 col-span-2">
                    <label className="text-[10px] text-zinc-500 uppercase font-bold">Binaural Mode</label>
                    <select value={seg.config.binaural} onChange={(e) => updateConfig(index, 'binaural', e.target.value)} onMouseDown={(e) => e.stopPropagation()} className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-full">
                      <option value="off">Off</option>
                      <option value="focus">Focus</option>
                      <option value="relax">Relax</option>
                      <option value="sleep">Sleep</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <SliderInput
                      label="Carrier Freq (Hz)"
                      min={0}
                      max={1000}
                      step={1}
                      value={seg.config.carrierFreq ?? 200}
                      onChange={(val) => updateConfig(index, 'carrierFreq', val)}
                    />
                  </div>
                  <div className="col-span-2">
                    <SliderInput
                      label="Beat Freq (Hz)"
                      min={0}
                      max={40}
                      step={0.1}
                      value={seg.config.beatFreq ?? 10}
                      onChange={(val) => updateConfig(index, 'beatFreq', val)}
                    />
                  </div>
                  <div className="col-span-2">
                    <SliderInput
                      label="Amp Mod (Hz)"
                      min={0}
                      max={40}
                      step={0.1}
                      value={seg.config.ampModulation ?? 0}
                      onChange={(val) => updateConfig(index, 'ampModulation', val)}
                    />
                  </div>
                </>
              ) : activeBubble.type === 'audio' ? (
                <>
                  <div className="flex flex-col gap-1 col-span-2">
                    <label className="text-[10px] text-zinc-500 uppercase font-bold">Audio URL</label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="https://..."
                        value={seg.config.audioUrl || ''} 
                        onChange={(e) => updateConfig(index, 'audioUrl', e.target.value)} 
                        onMouseDown={(e) => e.stopPropagation()}
                        className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 min-w-0" 
                      />
                      <button
                        onClick={handleTranscribe}
                        onMouseDown={(e) => e.stopPropagation()}
                        disabled={!seg.config.audioUrl || isTranscribing}
                        className="p-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 border border-zinc-700 rounded-lg text-emerald-400 transition-colors"
                        title="Transcribe Audio"
                      >
                        {isTranscribing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                      </button>
                    </div>
                    {isTranscribing && transcribeProgress && (
                      <div className="text-[10px] text-emerald-400 mt-1 animate-pulse">
                        {transcribeProgress}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 col-span-2">
                    <label 
                      onMouseDown={(e) => e.stopPropagation()}
                      className="flex items-center justify-center px-3 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg cursor-pointer transition-colors text-zinc-300 text-xs gap-2"
                    >
                      <Upload size={14} />
                      Upload File
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
                </>
              ) : activeBubble.type === 'pattern' ? (
                <>
                  <div className="flex flex-col gap-1 col-span-2">
                    <label className="text-[10px] text-zinc-500 uppercase font-bold">Pattern Type</label>
                    <select value={getValidPatternType(seg.config.patternType)} onChange={(e) => {
                      const newType = e.target.value;
                      let defaultPattern = 'flat spiral';
                      if (newType === 'repetition') defaultPattern = 'grid';
                      else if (newType === 'cloud') defaultPattern = 'particle';
                      else if (newType === 'cluster') defaultPattern = 'disordered';
                      else if (newType === 'topology') defaultPattern = 'orb';
                      
                      updateConfigs(index, {
                        patternType: newType,
                        pattern: defaultPattern
                      });
                    }} onMouseDown={(e) => e.stopPropagation()} className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-full">
                      <option value="fascinator">Fascinator</option>
                      <option value="repetition">Repetition</option>
                      <option value="cloud">Cloud</option>
                      <option value="cluster">Cluster</option>
                      <option value="topology">Topology</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1 col-span-2">
                    <label className="text-[10px] text-zinc-500 uppercase font-bold">Pattern</label>
                    <select value={getValidPattern(seg.config.patternType, seg.config.pattern)} onChange={(e) => updateConfig(index, 'pattern', e.target.value)} onMouseDown={(e) => e.stopPropagation()} className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-full">
                      {(getValidPatternType(seg.config.patternType) === 'fascinator') && (
                        <>
                          <option value="mandala">Mandala</option>
                          <option value="flame">Flame</option>
                          <option value="dot">Dot</option>
                          <option value="flat spiral">Flat Spiral</option>
                          <option value="thicc spiral">Thicc Spiral</option>
                          <option value="pendulum">Pendulum</option>
                          <option value="wheel">Wheel</option>
                          <option value="dial">Dial</option>
                          <option value="clock">Clock</option>
                          <option value="ring">Ring</option>
                          <option value="kaleido">Kaleido</option>
                        </>
                      )}
                      {getValidPatternType(seg.config.patternType) === 'repetition' && (
                        <>
                          <option value="grid">Grid</option>
                          <option value="march">March</option>
                          <option value="helix">Helix</option>
                          <option value="spiral">Spiral</option>
                          <option value="vortex">Vortex</option>
                          <option value="sphere">Sphere</option>
                          <option value="cube">Cube</option>
                          <option value="polygon">Polygon</option>
                        </>
                      )}
                      {getValidPatternType(seg.config.patternType) === 'cloud' && (
                        <>
                          <option value="particle">Particle</option>
                          <option value="nebula">Nebula</option>
                          <option value="smoke">Smoke</option>
                          <option value="fluid">Fluid</option>
                          <option value="swarm">Swarm</option>
                          <option value="constellation">Constellation</option>
                          <option value="bubbles">Bubbles</option>
                        </>
                      )}
                      {getValidPatternType(seg.config.patternType) === 'cluster' && (
                        <>
                          <option value="disordered">Disordered</option>
                          <option value="float">Float</option>
                          <option value="orbit">Orbit</option>
                          <option value="pulse">Pulse</option>
                          <option value="vortex">Vortex</option>
                        </>
                      )}
                      {getValidPatternType(seg.config.patternType) === 'topology' && (
                        <>
                          <option value="orb">Orb</option>
                          <option value="tunnel">Tunnel</option>
                          <option value="wave">Wave</option>
                          <option value="nautilus spiral">Nautilus Spiral</option>
                          <option value="cone spiral">Cone Spiral</option>
                          <option value="saddle">Saddle</option>
                          <option value="plane">Plane</option>
                          <option value="random voxel surface">Random Voxel Surface</option>
                          <option value="random curved surface">Random Curved Surface</option>
                          <option value="galaxy">Galaxy</option>
                        </>
                      )}
                    </select>
                  </div>
                  {/* Base Fascinator Selection for Cluster/Repetition */}
                  {(getValidPatternType(seg.config.patternType) === 'cluster' || getValidPatternType(seg.config.patternType) === 'repetition') && (
                    <div className="flex flex-col gap-1 col-span-2">
                      <label className="text-[10px] text-zinc-500 uppercase font-bold">
                        Base Fascinator
                      </label>
                      <select 
                        value={
                          getValidPatternType(seg.config.patternType) === 'cluster' ? (seg.config.clusterBasePattern || 'dot') : 
                          (seg.config.repetitionBasePattern || 'dot')
                        } 
                        onChange={(e) => updateConfig(index, 
                          getValidPatternType(seg.config.patternType) === 'cluster' ? 'clusterBasePattern' : 
                          'repetitionBasePattern', 
                          e.target.value
                        )} 
                        onMouseDown={(e) => e.stopPropagation()} 
                        className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-full"
                      >
                        {getAvailablePatterns('fascinator').map(p => (
                          <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Pattern Specific Configs */}
                  {getValidPatternType(seg.config.patternType) === 'repetition' && (
                    <div className="col-span-2">
                      <SliderInput 
                        label="Count" 
                        value={seg.config.repetitionCount || 10} 
                        min={1} max={50} step={1} 
                        onChange={(val) => updateConfig(index, 'repetitionCount', val)} 
                      />
                    </div>
                  )}

                  {getValidPatternType(seg.config.patternType) === 'cluster' && (
                    <>
                      <div className="col-span-2">
                        <SliderInput 
                          label="Count" 
                          value={seg.config.clusterCount || 20} 
                          min={1} max={100} step={1} 
                          onChange={(val) => updateConfig(index, 'clusterCount', val)} 
                        />
                      </div>
                      <div className="col-span-2">
                        <SliderInput 
                          label="Chaos" 
                          value={seg.config.clusterChaos || 50} 
                          min={0} max={100} step={1} 
                          onChange={(val) => updateConfig(index, 'clusterChaos', val)} 
                        />
                      </div>
                    </>
                  )}

                  {getValidPatternType(seg.config.patternType) === 'topology' && (seg.config.pattern === 'wave' || seg.config.pattern === 'saddle') && (
                    <>
                      <div className="col-span-2">
                        <SliderInput 
                          label="Amplitude" 
                          value={seg.config.topologyAmplitude ?? 1.0} 
                          min={0} max={5} step={0.1} 
                          onChange={(val) => updateConfig(index, 'topologyAmplitude', val)} 
                        />
                      </div>
                      <div className="col-span-2">
                        <SliderInput 
                          label="Frequency" 
                          value={seg.config.topologyFrequency ?? 1.0} 
                          min={0.1} max={5} step={0.1} 
                          onChange={(val) => updateConfig(index, 'topologyFrequency', val)} 
                        />
                      </div>
                    </>
                  )}

                  <div className="col-span-4">
                    <PaletteManager 
                      palette={seg.config.palette || ['#ffffff', '#00ff88', '#0066ff']} 
                      onChange={(newPalette) => updateConfig(index, 'palette', newPalette)} 
                    />
                  </div>
                  <div className="col-span-2">
                    <SliderInput
                      label="Pattern Scale"
                      min={0.1}
                      max={5}
                      step={0.1}
                      value={seg.config.patternScale ?? 1.0}
                      onChange={(val) => updateConfig(index, 'patternScale', val)}
                    />
                  </div>
                  <div className="col-span-2">
                    <SliderInput
                      label="Complexity"
                      min={1}
                      max={10}
                      step={1}
                      value={seg.config.patternComplexity ?? 1}
                      onChange={(val) => updateConfig(index, 'patternComplexity', val)}
                    />
                  </div>
                  {/* Conditional Sliders based on pattern effect */}
                  {(() => {
                    const type = getValidPatternType(seg.config.patternType);
                    const pattern = getValidPattern(type, seg.config.pattern);
                    
                    const showDensity = (type === 'fascinator' && ['mandala', 'particle', 'particles', 'cone spiral', 'spiral', 'wheel', 'kaleido', 'flat spiral', 'thicc spiral', 'dial', 'ring'].includes(pattern)) ||
                                       (type === 'cloud' && ['particle', 'nebula'].includes(pattern)) ||
                                       (type === 'topology') ||
                                       (type === 'cluster' || type === 'repetition');
                    
                    const showThickness = (type === 'fascinator' && ['mandala', 'flame', 'dot', 'flat spiral', 'thicc spiral', 'dial', 'clock', 'ring', 'kaleido', 'particle', 'particles'].includes(pattern)) ||
                                         (type === 'cloud' && ['nebula'].includes(pattern)) ||
                                         (type === 'topology' && ['orb', 'tunnel'].includes(pattern));
                    
                    const showLength = (type === 'fascinator' && pattern === 'pendulum') ||
                                      (type === 'topology' && pattern === 'tunnel');
                    
                    const showRadius = (type === 'topology' && pattern === 'tunnel');
                    
                    const showRoughness = (type === 'topology' && ['random voxel surface', 'random curved surface'].includes(pattern));
                    
                    const showSpacing = (type === 'topology' && pattern === 'orb');

                    return (
                      <>
                        {showDensity && (
                          <div className="col-span-2">
                            <SliderInput
                              label="Density"
                              min={0.1}
                              max={5}
                              step={0.1}
                              value={seg.config.patternDensity ?? 1.0}
                              onChange={(val) => updateConfig(index, 'patternDensity', val)}
                            />
                          </div>
                        )}
                        {showThickness && (
                          <div className="col-span-2">
                            <SliderInput
                              label="Thickness"
                              min={0.1}
                              max={5}
                              step={0.1}
                              value={seg.config.patternThickness ?? 1.0}
                              onChange={(val) => updateConfig(index, 'patternThickness', val)}
                            />
                          </div>
                        )}
                        {showLength && (
                          <div className="col-span-2">
                            <SliderInput
                              label="Length"
                              min={0.1}
                              max={5}
                              step={0.1}
                              value={seg.config.patternLength ?? 1.0}
                              onChange={(val) => updateConfig(index, 'patternLength', val)}
                            />
                          </div>
                        )}
                        {showRadius && (
                          <div className="col-span-2">
                            <SliderInput
                              label="Radius"
                              min={0.1}
                              max={5}
                              step={0.1}
                              value={seg.config.patternRadius ?? 1.0}
                              onChange={(val) => updateConfig(index, 'patternRadius', val)}
                            />
                          </div>
                        )}
                        {showRoughness && (
                          <div className="col-span-2">
                            <SliderInput
                              label="Roughness"
                              min={0}
                              max={5}
                              step={0.1}
                              value={seg.config.patternRoughness ?? 1.0}
                              onChange={(val) => updateConfig(index, 'patternRoughness', val)}
                            />
                          </div>
                        )}
                        {showSpacing && (
                          <div className="col-span-2">
                            <SliderInput
                              label="Spacing"
                              min={0.1}
                              max={5}
                              step={0.1}
                              value={seg.config.patternSpacing ?? 1.0}
                              onChange={(val) => updateConfig(index, 'patternSpacing', val)}
                            />
                          </div>
                        )}
                      </>
                    );
                  })()}
                  {(seg.config.pattern === 'flat spiral' || seg.config.pattern === 'thicc spiral') && (
                    <>
                      <div className="col-span-2">
                        <SliderInput label="Spiral Arms" min={1} max={20} step={1} value={seg.config.spiralArms ?? 5} onChange={(val) => updateConfig(index, 'spiralArms', val)} />
                      </div>
                      <div className="col-span-2">
                        <SliderInput label="Spiral Thickness" min={0.01} max={5} step={0.01} value={seg.config.spiralThickness ?? 0.5} onChange={(val) => updateConfig(index, 'spiralThickness', val)} logarithmic />
                      </div>
                      <div className="col-span-2">
                        <SliderInput label="Spiral Curvature" min={0} max={5} step={0.01} value={seg.config.spiralCurvature ?? 1.0} onChange={(val) => updateConfig(index, 'spiralCurvature', val)} logarithmic />
                      </div>
                      {(seg.config.pattern === 'flat spiral' || seg.config.pattern === 'thicc spiral') && (
                        <div className="col-span-2">
                          <SliderInput label="Spiral Elasticity" min={0} max={1} step={0.01} value={seg.config.spiralElasticity ?? 0.5} onChange={(val) => updateConfig(index, 'spiralElasticity', val)} logarithmic />
                        </div>
                      )}
                    </>
                  )}
                </>
              ) : activeBubble.type === 'anim_config' ? (
                <>
                  <div className="flex flex-col gap-1 col-span-2">
                    <label className="text-[10px] text-zinc-500 uppercase font-bold">Face Camera</label>
                    <select value={seg.config.patternFaceCamera === undefined ? 'true' : (seg.config.patternFaceCamera ? 'true' : 'false')} onChange={(e) => updateConfig(index, 'patternFaceCamera', e.target.value === 'true')} onMouseDown={(e) => e.stopPropagation()} className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-full">
                      <option value="false">Off</option>
                      <option value="true">On</option>
                    </select>
                  </div>
                  {getValidPatternType(seg.config.patternType) === 'repetition' && (
                    <div className="flex flex-col gap-1 col-span-2">
                      <label className="text-[10px] text-zinc-500 uppercase font-bold">Repetition Animation</label>
                      <select value={seg.config.repetitionAnimation || 'none'} onChange={(e) => updateConfig(index, 'repetitionAnimation', e.target.value)} onMouseDown={(e) => e.stopPropagation()} className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500">
                        <option value="none">None</option>
                        <option value="wave">Wave</option>
                        <option value="pulse">Pulse</option>
                        <option value="random">Random</option>
                        <option value="snake">Snake</option>
                      </select>
                    </div>
                  )}
                  {getValidPatternType(seg.config.patternType) === 'cloud' && (
                    <div className="flex flex-col gap-1 col-span-2">
                      <label className="text-[10px] text-zinc-500 uppercase font-bold">Cloud Animation</label>
                      <select value={seg.config.cloudAnimation || 'none'} onChange={(e) => updateConfig(index, 'cloudAnimation', e.target.value)} onMouseDown={(e) => e.stopPropagation()} className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500">
                        <option value="none">None</option>
                        <option value="wave">Wave</option>
                        <option value="pulse">Pulse</option>
                        <option value="random">Random</option>
                        <option value="snake">Snake</option>
                      </select>
                    </div>
                  )}
                  <div className="col-span-2">
                    <SliderInput
                      label="Pattern Speed"
                      min={seg.config.pattern?.includes('spiral') ? -5 : 0}
                      max={5}
                      step={0.1}
                      value={seg.config.patternSpeed ?? 1.0}
                      onChange={(val) => updateConfig(index, 'patternSpeed', val)}
                    />
                  </div>
                  {(getValidPatternType(seg.config.patternType) === 'repetition' || getValidPatternType(seg.config.patternType) === 'cluster') ? (
                    <>
                      <div className="col-span-2">
                        <SliderInput
                          label="Base Spin"
                          min={-5}
                          max={5}
                          step={0.1}
                          value={seg.config.baseSpin ?? 0}
                          onChange={(val) => updateConfig(index, 'baseSpin', val)}
                        />
                      </div>
                      <div className="col-span-2">
                        <SliderInput
                          label="Base Rotation"
                          min={-5}
                          max={5}
                          step={0.1}
                          value={seg.config.baseRotation ?? 0}
                          onChange={(val) => updateConfig(index, 'baseRotation', val)}
                        />
                      </div>
                      <div className="col-span-2">
                        <SliderInput
                          label="Base Tumble"
                          min={-5}
                          max={5}
                          step={0.1}
                          value={seg.config.baseTumble ?? 0}
                          onChange={(val) => updateConfig(index, 'baseTumble', val)}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="col-span-2">
                        <SliderInput
                          label="Pattern Spin"
                          min={-5}
                          max={5}
                          step={0.1}
                          value={seg.config.patternSpin ?? 0}
                          onChange={(val) => updateConfig(index, 'patternSpin', val)}
                        />
                      </div>
                      <div className="col-span-2">
                        <SliderInput
                          label="Pattern Rotation"
                          min={-5}
                          max={5}
                          step={0.1}
                          value={seg.config.patternRotation ?? 0}
                          onChange={(val) => updateConfig(index, 'patternRotation', val)}
                        />
                      </div>
                      <div className="col-span-2">
                        <SliderInput
                          label="Pattern Tumble"
                          min={-5}
                          max={5}
                          step={0.1}
                          value={seg.config.patternTumble ?? 0}
                          onChange={(val) => updateConfig(index, 'patternTumble', val)}
                        />
                      </div>
                    </>
                  )}
                </>
              ) : activeBubble.type === 'camera' ? (
                <>
                  <div className="flex flex-col gap-1 col-span-2">
                    <label className="text-[10px] text-zinc-500 uppercase font-bold">Camera Mode</label>
                    <select value={seg.config.camera} onChange={(e) => updateConfig(index, 'camera', e.target.value)} onMouseDown={(e) => e.stopPropagation()} className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-full">
                      <option value="static">Static</option>
                      <option value="orbit">Orbit</option>
                      <option value="fly">Fly</option>
                      <option value="pan">Pan</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <SliderInput
                      label="Camera Speed"
                      min={0}
                      max={5}
                      step={0.1}
                      value={seg.config.cameraSpeed ?? 1.0}
                      onChange={(val) => updateConfig(index, 'cameraSpeed', val)}
                    />
                  </div>
                  <div className="flex flex-col gap-1 col-span-2">
                    <label className="text-[10px] text-zinc-500 uppercase font-bold">Radius</label>
                    <input type="number" step="0.5" value={seg.config.cameraRadius ?? ''} onChange={(e) => updateConfig(index, 'cameraRadius', parseFloat(e.target.value) || undefined)} onMouseDown={(e) => e.stopPropagation()} className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-full" placeholder="Auto" />
                  </div>
                  <div className="flex flex-col gap-1 col-span-2">
                    <label className="text-[10px] text-zinc-500 uppercase font-bold">Height</label>
                    <input type="number" step="0.1" value={seg.config.cameraHeight ?? ''} onChange={(e) => updateConfig(index, 'cameraHeight', parseFloat(e.target.value) || undefined)} onMouseDown={(e) => e.stopPropagation()} className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-full" placeholder="Auto" />
                  </div>
                  <div className="flex flex-col gap-1 col-span-2">
                    <label className="text-[10px] text-zinc-500 uppercase font-bold">Target X</label>
                    <input type="number" step="0.5" value={seg.config.cameraTargetX ?? 0} onChange={(e) => updateConfig(index, 'cameraTargetX', parseFloat(e.target.value) || 0)} onMouseDown={(e) => e.stopPropagation()} className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-full" />
                  </div>
                  <div className="flex flex-col gap-1 col-span-2">
                    <label className="text-[10px] text-zinc-500 uppercase font-bold">Target Y</label>
                    <input type="number" step="0.5" value={seg.config.cameraTargetY ?? 0} onChange={(e) => updateConfig(index, 'cameraTargetY', parseFloat(e.target.value) || 0)} onMouseDown={(e) => e.stopPropagation()} className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-full" />
                  </div>
                  <div className="flex flex-col gap-1 col-span-2">
                    <label className="text-[10px] text-zinc-500 uppercase font-bold">Target Z</label>
                    <input type="number" step="0.5" value={seg.config.cameraTargetZ ?? 0} onChange={(e) => updateConfig(index, 'cameraTargetZ', parseFloat(e.target.value) || 0)} onMouseDown={(e) => e.stopPropagation()} className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-full" />
                  </div>
                  <div className="flex flex-col gap-1 col-span-2">
                    <label className="text-[10px] text-zinc-500 uppercase font-bold">FOV</label>
                    <input type="number" step="0.1" value={seg.config.cameraFov ?? ''} onChange={(e) => updateConfig(index, 'cameraFov', parseFloat(e.target.value) || undefined)} onMouseDown={(e) => e.stopPropagation()} className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-full" placeholder="Auto" />
                  </div>
                </>
              ) : (activeBubble.type === 'image' || activeBubble.type === 'video') ? (
                <div className="col-span-4 flex flex-col gap-3">
                  {(() => {
                    const m = media[activeBubble.index ?? 0];
                    if (!m) return <div className="text-zinc-500 text-xs italic">Item not found</div>;
                    return (
                      <>
                        <CompactUrlPicker 
                          url={m.url} 
                          autoFocus
                          onChange={(url) => handleMediaChange(activeBubble.index ?? 0, 'url', url)} 
                          placeholder={`${activeBubble.type === 'image' ? 'Image' : 'Video'} URL`}
                        />
                        <SliderInput label="Opacity" value={m.opacity} min={0} max={1} step={0.1} onChange={(val) => handleMediaChange(activeBubble.index ?? 0, 'opacity', val)} />
                        {m.type === 'video' && (
                          <SliderInput label="Volume" value={m.volume ?? 1} min={0} max={1} step={0.1} onChange={(val) => handleMediaChange(activeBubble.index ?? 0, 'volume', val)} />
                        )}
                        <button 
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          onClick={() => {
                            removeMedia(activeBubble.index ?? 0);
                            setActiveBubble(null);
                          }} 
                          className="mt-2 py-1.5 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded text-xs flex items-center justify-center gap-1"
                        >
                          <Trash2 size={12}/> Remove {activeBubble.type === 'image' ? 'Image' : 'Video'}
                        </button>
                      </>
                    );
                  })()}
                </div>
              ) : activeBubble.type === 'wordlist' ? (
                <div className="col-span-4 flex flex-col gap-3">
                  {(() => {
                    const wl = wordlists[activeBubble.index ?? 0];
                    if (!wl) return <div className="text-zinc-500 text-xs italic">Item not found</div>;
                    return (
                      <>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-zinc-500 uppercase font-bold">Predefined Lists</label>
                          <select 
                            className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-full"
                            onMouseDown={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              const keyword = e.target.value;
                              if (keyword) {
                                handleWordlistChange(activeBubble.index ?? 0, 'words', keyword);
                              }
                            }}
                            value={PREBUILT_WORDLISTS[wl.words.toLowerCase()] ? wl.words.toLowerCase() : ''}
                          >
                            <option value="">Custom / Select...</option>
                            {Object.keys(PREBUILT_WORDLISTS).map(name => (
                              <option key={name} value={name}>{name.charAt(0).toUpperCase() + name.slice(1)}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-zinc-500 uppercase font-bold">Words (comma separated)</label>
                          <input 
                            type="text" 
                            autoFocus
                            value={wl.words} 
                            onChange={(e) => handleWordlistChange(activeBubble.index ?? 0, 'words', e.target.value)} 
                            onMouseDown={(e) => e.stopPropagation()}
                            className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-full" 
                            placeholder="relax,breathe,focus" 
                          />
                          {PREBUILT_WORDLISTS[wl.words.toLowerCase()] ? (
                            <div className="mt-1 p-2 bg-zinc-950/50 border border-zinc-800/50 rounded text-[9px] text-emerald-400/80 leading-relaxed max-h-20 overflow-y-auto">
                              <strong>Expanded:</strong> {PREBUILT_WORDLISTS[wl.words.toLowerCase()].join(', ')}
                            </div>
                          ) : (
                            <p className="text-[9px] text-zinc-500 italic mt-0.5">Tip: You can also paste a URL to a CSV file here.</p>
                          )}
                        </div>
                        <SliderInput label="Interval (s)" value={wl.interval} min={0.1} max={5} step={0.1} onChange={(val) => handleWordlistChange(activeBubble.index ?? 0, 'interval', val)} />
                        <SliderInput label="Count (words at once)" value={wl.count} min={1} max={10} step={1} onChange={(val) => handleWordlistChange(activeBubble.index ?? 0, 'count', val)} />
                        <button 
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }} 
                          onClick={() => removeWordlist(activeBubble.index ?? 0)} 
                          className="mt-2 py-1.5 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded text-xs flex items-center justify-center gap-1"
                        >
                          <Trash2 size={12}/> Remove Wordlist
                        </button>
                      </>
                    );
                  })()}
                </div>
              ) : (
                <div className="col-span-4">
                  <SliderInput
                    label="Metronome (BPM)"
                    min={0}
                    max={300}
                    step={1}
                    value={seg.config.metronome ?? 0}
                    onChange={(val) => updateConfig(index, 'metronome', val)}
                  />
                </div>
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

      <div className="grid grid-cols-3 gap-2 mt-1">
        <button 
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setActiveBubble(activeBubble?.type === 'pattern' ? null : { type: 'pattern' })}
          data-bubble-toggle="true"
          className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border transition-all text-[10px] font-bold uppercase tracking-wider ${activeBubble?.type === 'pattern' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.1)]' : 'text-zinc-400 bg-zinc-900/50 border-zinc-800 hover:text-white hover:bg-zinc-900 hover:border-zinc-700'}`}
          title="Pattern Settings"
        >
          <Orbit size={14} />
          Pattern
        </button>
        <button 
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setActiveBubble(activeBubble?.type === 'anim_config' ? null : { type: 'anim_config' })}
          data-bubble-toggle="true"
          className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border transition-all text-[10px] font-bold uppercase tracking-wider ${activeBubble?.type === 'anim_config' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.1)]' : 'text-zinc-400 bg-zinc-900/50 border-zinc-800 hover:text-white hover:bg-zinc-900 hover:border-zinc-700'}`}
          title="Animation Settings"
        >
          <Activity size={14} />
          Animation
        </button>
        <button 
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setActiveBubble(activeBubble?.type === 'camera' ? null : { type: 'camera' })}
          data-bubble-toggle="true"
          className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border transition-all text-[10px] font-bold uppercase tracking-wider ${activeBubble?.type === 'camera' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.1)]' : 'text-zinc-400 bg-zinc-900/50 border-zinc-800 hover:text-white hover:bg-zinc-900 hover:border-zinc-700'}`}
          title="Camera Settings"
        >
          <Camera size={14} />
          Camera
        </button>
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

  const updateConfigs = (index: number, configs: Partial<SegmentConfig>) => {
    const newSegments = [...segments];
    newSegments[index] = {
      ...newSegments[index],
      config: {
        ...newSegments[index].config,
        ...configs
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
      media: parsedContent.media
    };
    onChange(newSegments);
  };

  const addSegment = () => {
    const newSegments = [...segments];
    const lastConfig = segments.length > 0 ? segments[segments.length - 1].config : {
      duration: 10,
      patternType: 'fascinator',
      pattern: 'flat spiral',
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
      media: parsedContent.media
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
          updateConfigs={updateConfigs}
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
