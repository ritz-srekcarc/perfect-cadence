/**
 * Timeline Parser
 * 
 * Handles the conversion between the markdown-based timeline format 
 * and the structured TimelineSegment objects used by the application.
 */

/**
 * Configuration for a single segment of the timeline.
 * Controls visuals, camera, text animations, and audio.
 */
export interface SegmentConfig {
  duration: number; // in seconds
  patternType: 'fascinator' | 'repetition' | 'cloud' | 'cluster' | 'topology' | string;
  pattern: 'fractal' | 'mandala' | 'particle' | 'flame' | 'dot' | 'flat spiral' | 'cone spiral' | 'pendulum' | 'tunnel' | 'ring' | 'kaleido' | 'pulse' | 'wave' | 'nautilus spiral' | 'orb' | 'saddle' | 'plane' | 'random voxel surface' | 'random curved surface' | string;
  patternSpeed?: number;
  patternScale?: number;
  patternComplexity?: number;
  palette?: string[];
  patternColor1?: string;
  patternColor2?: string;
  patternFaceCamera?: boolean;
  spiralArms?: number;
  spiralThickness?: number;
  spiralCurvature?: number;
  spiralElasticity?: number;
  patternSpin?: number;
  patternRotation?: number;
  patternTumble?: number;
  baseSpin?: number;
  baseRotation?: number;
  baseTumble?: number;
  camera: 'orbit' | 'fly' | 'static' | 'pan' | string;
  cameraSpeed?: number;
  cameraRadius?: number;
  cameraHeight?: number;
  cameraAlpha?: number;
  cameraTargetX?: number;
  cameraTargetY?: number;
  cameraTargetZ?: number;
  cameraFov?: number;
  textFont?: string;
  textDistance?: number;
  textSize?: number;
  textOutlineType?: 'none' | 'rainbow' | 'solid';
  textOutlineColor?: string;
  textOutlineWidth?: number;
  textColor?: string;
  textShading?: boolean;
  textBackdrop?: boolean;
  textAnimType?: 'none' | 'zoom' | 'fade' | 'float' | 'warp' | 'prism' | 'glitch' | string;
  textAnimSpeed?: number;
  textAnimIntensity?: number;
  textDisplayPattern?: 'center' | 'scatter' | 'random' | 'spiral' | 'march' | string;
  textFaceCamera?: boolean;
  auxFont?: string;
  auxDistance?: number;
  auxSize?: number;
  auxOutlineType?: 'none' | 'rainbow' | 'solid';
  auxOutlineColor?: string;
  auxOutlineWidth?: number;
  auxColor?: string;
  auxShading?: boolean;
  auxBackdrop?: boolean;
  auxAnimType?: 'none' | 'zoom' | 'fade' | 'float' | 'warp' | 'prism' | 'glitch' | string;
  auxAnimSpeed?: number;
  auxAnimIntensity?: number;
  auxDisplayPattern?: 'center' | 'scatter' | 'random' | 'spiral' | 'march' | string;
  binaural: 'off' | 'focus' | 'relax' | 'sleep' | 'custom' | string;
  carrierFreq?: number;
  beatFreq?: number;
  ampModulation?: number;
  metronome: number; // BPM, 0 for off
  audioUrl?: string; // Custom audio URL
  speech_synth?: boolean;
  speech_voice?: string;
  speech_speed?: number;
  repetitionCount?: number;
  repetitionBasePattern?: string;
  repetitionAnimation?: 'none' | 'wave' | 'pulse' | 'random' | 'snake' | string;
  clusterCount?: number;
  clusterBasePattern?: string;
  clusterChaos?: number;
  cloudAnimation?: 'none' | 'wave' | 'pulse' | 'random' | 'snake' | string;
  topologyAmplitude?: number;
  topologyFrequency?: number;
}

export interface MediaItem {
  type: 'image' | 'video';
  url: string;
  opacity: number;
  volume?: number;
  layer: 'main' | 'aux';
}

export const PREBUILT_WORDLISTS: Record<string, string[]> = {
  relax: ["calm", "peace", "serene", "tranquil", "breathe", "drift", "float", "sink", "deep", "down", "heavy", "warm", "safe", "secure", "let go", "release", "soothe", "quiet", "still", "rest"],
  focus: ["attention", "concentrate", "sharp", "clear", "mind", "center", "now", "here", "present", "aware", "alert", "awake", "steady", "gaze", "fix", "point", "direct", "guide", "flow", "zone"],
  sleep: ["drowsy", "tired", "slumber", "dream", "night", "dark", "soft", "bed", "pillow", "blanket", "snug", "cozy", "yawn", "nod", "doze", "nap", "snooze", "restful", "deepen", "fade"],
  confidence: ["strong", "power", "bold", "brave", "sure", "certain", "proud", "tall", "stand", "speak", "voice", "clear", "loud", "firm", "solid", "rock", "base", "root", "grow", "shine"],
  energy: ["wake", "rise", "sun", "light", "bright", "spark", "fire", "heat", "move", "act", "do", "go", "fast", "quick", "speed", "rush", "surge", "pulse", "beat", "alive"],
  gratitude: ["gratitude", "thanks", "blessing", "love", "kindness", "joy", "heart", "open", "appreciate", "value", "gift", "grace", "warmth", "smile", "peace", "full", "enough", "content", "blessed", "share"]
};

export interface TimelineSegment {
  id: string;
  config: SegmentConfig;
  text: string;
  auxText?: string;
  media: MediaItem[];
  rawMarkdown: string;
}

const KEY_MAP: Record<string, string> = {
  duration: 'd',
  pattern: 'p',
  patternType: 'pt',
  patternSpeed: 'ps',
  patternScale: 'psc',
  patternComplexity: 'pc',
  palette: 'pal',
  patternColor1: 'c1',
  patternColor2: 'c2',
  patternFaceCamera: 'pfc',
  spiralArms: 'sa',
  spiralThickness: 'st',
  spiralCurvature: 'sc',
  spiralElasticity: 'se',
  patternSpin: 'psn',
  patternRotation: 'prt',
  patternTumble: 'ptm',
  baseSpin: 'bsn',
  baseRotation: 'brt',
  baseTumble: 'btm',
  camera: 'ca',
  cameraSpeed: 'cs',
  cameraRadius: 'cr',
  cameraHeight: 'ch',
  cameraAlpha: 'caA',
  cameraTargetX: 'tx',
  cameraTargetY: 'ty',
  cameraTargetZ: 'tz',
  cameraFov: 'fov',
  textFont: 'tf',
  textDistance: 'td',
  textSize: 'ts',
  textOutlineType: 'tot',
  textOutlineColor: 'toc',
  textOutlineWidth: 'tow',
  textColor: 'tc',
  textShading: 'tsh',
  textBackdrop: 'tbd',
  textAnimType: 'tat',
  textAnimSpeed: 'tas',
  textAnimIntensity: 'tai',
  textDisplayPattern: 'tdp',
  textFaceCamera: 'tfc',
  auxFont: 'af',
  auxDistance: 'ad',
  auxSize: 'as',
  auxOutlineType: 'aot',
  auxOutlineColor: 'aoc',
  auxOutlineWidth: 'aow',
  auxColor: 'ac',
  auxShading: 'ash',
  auxBackdrop: 'abd',
  auxAnimType: 'aat',
  auxAnimSpeed: 'aas',
  auxAnimIntensity: 'aai',
  auxDisplayPattern: 'adp',
  binaural: 'bin',
  metronome: 'm',
  carrierFreq: 'cf',
  beatFreq: 'bf',
  ampModulation: 'am',
  audioUrl: 'au',
  speech_synth: 'ss',
  speech_voice: 'sv',
  speech_speed: 'ssp',
  repetitionCount: 'rc',
  repetitionBasePattern: 'rbp',
  repetitionAnimation: 'ra',
  clusterCount: 'cc',
  clusterBasePattern: 'cbp',
  clusterChaos: 'cch',
  cloudAnimation: 'cla',
  topologyAmplitude: 'ta',
  topologyFrequency: 'tf'
};

const VALUE_MAP: Record<string, string> = {
  fascinator: 'fas',
  repetition: 'rep',
  cloud: 'cld',
  cluster: 'clu',
  topology: 'top',
  fractal: 'fr',
  mandala: 'ma',
  particle: 'pa',
  flame: 'fla',
  dot: 'do',
  'flat spiral': 'fs',
  pendulum: 'pe',
  wave: 'wav',
  'nautilus spiral': 'ns',
  orb: 'orb',
  saddle: 'sa',
  plane: 'pl',
  'random voxel surface': 'rvs',
  'random curved surface': 'rcs',
  tunnel: 'tu',
  ring: 'ri',
  kaleido: 'ka',
  pulse: 'pu',
  grid: 'gr',
  helix: 'hel',
  spiral: 'spi',
  vortex: 'vor',
  sphere: 'sph',
  cube: 'cub',
  polygon: 'pol',
  galaxy: 'gal',
  swarm: 'swa',
  constellation: 'con',
  nebula: 'neb',
  smoke: 'smo',
  fluid: 'flu',
  bubbles: 'bub',
  orbit: 'or',
  fly: 'fly',
  static: 'st',
  pan: 'pn',
  'sans-serif': 'ss',
  serif: 'se',
  monospace: 'mo',
  cursive: 'cu',
  fantasy: 'fan',
  none: 'no',
  disordered: 'dis',
  rainbow: 'rb',
  solid: 'so',
  zoom: 'zo',
  fade: 'fad',
  float: 'flo',
  warp: 'war',
  prism: 'pr',
  glitch: 'gl',
  center: 'ce',
  scatter: 'sc',
  random: 'ra',
  march: 'mar',
  off: 'of',
  focus: 'fo',
  relax: 're',
  sleep: 'sl',
  custom: 'cus',
  snake: 'snk',
  wheel: 'wh',
  dial: 'di',
  clock: 'cl',
  torus: 'tor',
  'cone spiral': 'cs'
};

export const DEFAULT_MARKDOWN = `# Welcome to Perfect Cadence
Type your text here. Each line will be spoken and displayed.

Use markdown to format your timeline.
Separate segments with three dashes (---).

\`\`\`config
duration: 10
patternType: fascinator
pattern: flat spiral
camera: static
cameraHeight: 1.57
cameraAlpha: -1.57
cameraRadius: 30
palette: #ffffff,#00ff88,#0066ff
\`\`\`

---

## Next Segment
You can change the visuals per segment.

\`\`\`config
patternType: cluster
pattern: particle
camera: static
palette: #ff0088,#ff8800,#ffff00
\`\`\`
`;

/**
 * Parses a single segment's markdown content to extract text, aux text, and media.
 */
export function parseSegmentContent(rawMarkdown: string) {
  let text = rawMarkdown;
  const media: MediaItem[] = [];

  // Parse blockquote (auxText)
  const blockquoteRegex = /^>\s*(.*)$/gm;
  let auxTextLines = [];
  let bqMatch;
  while ((bqMatch = blockquoteRegex.exec(text)) !== null) {
    auxTextLines.push(bqMatch[1]);
  }
  let auxText = auxTextLines.length > 0 ? auxTextLines.join('\n') : undefined;
  text = text.replace(/^>\s*.*$/gm, '').trim();

  // Parse media regex
  const mediaRegex = /!\[\s*(\d+)\s*(?:,\s*(\d+)\s*)?\]\((.*?)\)/g;

  // Parse media in main text
  const mainMediaMatches = Array.from(text.matchAll(mediaRegex));
  for (const match of mainMediaMatches) {
    const url = match[3];
    const hasVolume = match[2] !== undefined;
    media.push({
      type: hasVolume || url.match(/\.(mp4|webm|ogg)$/i) ? 'video' : 'image',
      opacity: parseInt(match[1]) / 100,
      url: url,
      layer: 'main',
      ...(hasVolume && { volume: parseInt(match[2]) / 100 }),
    });
  }
  text = text.replace(mediaRegex, '');

  // Parse media in aux text
  if (auxText) {
    const auxMediaMatches = Array.from(auxText.matchAll(mediaRegex));
    for (const match of auxMediaMatches) {
      const url = match[3];
      const hasVolume = match[2] !== undefined;
      media.push({
        type: hasVolume || url.match(/\.(mp4|webm|ogg)$/i) ? 'video' : 'image',
        opacity: parseInt(match[1]) / 100,
        url: url,
        layer: 'aux',
        ...(hasVolume && { volume: parseInt(match[2]) / 100 }),
      });
    }
    auxText = auxText.replace(mediaRegex, '');
  }

  return { text: text.trim(), auxText, media };
}


export const SYNTAX_DOCS = {
  timeline: "Segments are separated by '---'. Each segment can start with a ```config ... ``` block.",
  config: {
    duration: "number (seconds)",
    patternType: "string (fascinator, repetition, cloud, cluster, topology)",
    pattern: "string (fractal, mandala, particle, flame, dot, flat spiral, pendulum, wave, nautilus spiral, orb, saddle, plane, random voxel surface, random curved surface, tunnel, ring, kaleido, pulse)",
    patternSpeed: "number (multiplier)",
    patternScale: "number (multiplier)",
    patternComplexity: "number (detail level)",
    patternColor1: "string (hex color)",
    patternColor2: "string (hex color)",
    patternFaceCamera: "boolean",
    spiralArms: "number",
    spiralThickness: "number",
    spiralCurvature: "number",
    camera: "string (orbit, fly, static, pan)",
    cameraSpeed: "number (multiplier)",
    cameraRadius: "number (distance from target)",
    cameraHeight: "number (beta angle in radians)",
    cameraAlpha: "number (alpha angle in radians)",
    cameraTargetX: "number",
    cameraTargetY: "number",
    cameraTargetZ: "number",
    cameraFov: "number (field of view in degrees)",
    textFont: "string (sans-serif, serif, monospace, cursive, fantasy)",
    textDistance: "number",
    textSize: "number",
    textOutlineType: "string (none, rainbow, solid)",
    textOutlineColor: "string (hex color)",
    textOutlineWidth: "number",
    textColor: "string (hex color)",
    textShading: "boolean",
    textBackdrop: "boolean",
    textAnimType: "string (none, zoom, fade, float, warp, prism, glitch)",
    textAnimSpeed: "number",
    textAnimIntensity: "number",
    textDisplayPattern: "string (center, scatter, random, spiral, march)",
    textFaceCamera: "boolean",
    auxFont: "string",
    auxDistance: "number",
    auxSize: "number",
    auxOutlineType: "string",
    auxOutlineColor: "string",
    auxOutlineWidth: "number",
    auxColor: "string",
    auxShading: "boolean",
    auxBackdrop: "boolean",
    auxAnimType: "string",
    auxAnimSpeed: "number",
    auxAnimIntensity: "number",
    auxDisplayPattern: "string (center, scatter, random, spiral, march)",
    binaural: "string (off, focus, relax, sleep, custom)",
    carrierFreq: "number (Hz)",
    beatFreq: "number (Hz)",
    ampModulation: "number (Hz)",
    metronome: "number (BPM, 0 for off)",
    audioUrl: "string (URL)",
    speech_synth: "boolean",
    speech_voice: "string",
    speech_speed: "number"
  },
  media: "![opacity,volume](url) - opacity 0-100, volume 0-100 (optional)",
  wordList: "!{interval,count}(list,of,words) or !{interval,count}(url_to_csv) - interval in seconds, count of words to display at once"
};

/**
 * Parses the entire markdown timeline into an array of TimelineSegment objects.
 * Handles configuration inheritance between segments.
 */
export function parseTimeline(markdown: string): TimelineSegment[] {
  const segments: TimelineSegment[] = [];
  const parts = markdown.split(/^\s*---\s*$/gm);

  let lastConfig: SegmentConfig = {
    duration: 10,
    patternType: 'fascinator',
    pattern: 'flat spiral',
    camera: 'static',
    cameraSpeed: 1.0,
    cameraRadius: 30,
    cameraHeight: 1.57,
    cameraAlpha: -1.57,
    textSize: 20,
    textDistance: 25,
    auxSize: 15,
    auxDistance: 25,
    binaural: 'off',
    metronome: 0,
    palette: ['#ffffff', '#00ff88', '#0066ff']
  };

  parts.forEach((part, index) => {
    const configMatch = part.match(/\`\`\`config\s*[\r\n]+([\s\S]*?)[\r\n]+\`\`\`/);
    let config: SegmentConfig = { ...lastConfig };

    let text = part;

    if (configMatch) {
      text = part.replace(configMatch[0], '').trim();
      const configLines = configMatch[1].split(/[\r\n]+/);
      configLines.forEach(line => {
        const [key, ...valueParts] = line.split(':');
        if (key && valueParts.length > 0) {
          const val = valueParts.join(':').trim();
          const k = key.trim() as keyof SegmentConfig;
          if (k === 'duration' || k === 'metronome' || k === 'carrierFreq' || k === 'beatFreq' || k === 'ampModulation' || k === 'cameraSpeed' || k === 'patternSpeed' || k === 'patternScale' || k === 'patternComplexity' || k === 'cameraRadius' || k === 'cameraHeight' || k === 'cameraAlpha' || k === 'cameraTargetX' || k === 'cameraTargetY' || k === 'cameraTargetZ' || k === 'cameraFov' || k === 'textDistance' || k === 'textSize' || k === 'textAnimSpeed' || k === 'textAnimIntensity' || k === 'auxDistance' || k === 'auxSize' || k === 'auxAnimSpeed' || k === 'auxAnimIntensity' || k === 'speech_speed' || k === 'repetitionCount' || k === 'clusterCount' || k === 'clusterChaos' || k === 'textOutlineWidth' || k === 'auxOutlineWidth' || k === 'topologyAmplitude' || k === 'topologyFrequency' || k === 'spiralArms' || k === 'spiralThickness' || k === 'spiralCurvature' || k === 'spiralElasticity' || k === 'patternSpin' || k === 'patternRotation' || k === 'patternTumble' || k === 'baseSpin' || k === 'baseRotation' || k === 'baseTumble') {
            (config as any)[k] = parseFloat(val);
          } else if (k === 'textShading' || k === 'textBackdrop' || k === 'auxShading' || k === 'auxBackdrop' || k === 'speech_synth' || k === 'patternFaceCamera' || k === 'textFaceCamera') {
            (config as any)[k] = val === 'true';
          } else if (k === 'palette') {
            (config as any)[k] = val.split(',').map(c => c.trim());
          } else {
            (config as any)[k] = val;
          }
        }
      });
      lastConfig = { ...config };
    } else {
      text = part.trim();
    }

    const rawMarkdown = text.trim();
    const parsedContent = parseSegmentContent(rawMarkdown);

    segments.push({
      id: `seg-${index}`,
      config,
      text: parsedContent.text,
      auxText: parsedContent.auxText,
      media: parsedContent.media,
      rawMarkdown,
    });
  });

  return segments;
}

/**
 * Serializes an array of TimelineSegment objects back into the markdown format.
 * Optimizes the output by only including configuration changes between segments.
 */
export function serializeTimeline(segments: TimelineSegment[]): string {
  let lastConfig: Partial<SegmentConfig> = {};
  
  return segments.map((seg, index) => {
    let md = '';
    if (index > 0) {
      md += '---\n\n';
    }
    
    let configStr = '';
    const c = seg.config as any;
    
    const keys = ['duration', 'pattern', 'patternType', 'repetitionCount', 'repetitionBasePattern', 'repetitionAnimation', 'clusterCount', 'clusterBasePattern', 'clusterChaos', 'cloudAnimation', 'topologyAmplitude', 'topologyFrequency', 'patternSpeed', 'patternScale', 'patternComplexity', 'palette', 'patternColor1', 'patternColor2', 'patternFaceCamera', 'spiralArms', 'spiralThickness', 'spiralCurvature', 'spiralElasticity', 'patternSpin', 'patternRotation', 'patternTumble', 'baseSpin', 'baseRotation', 'baseTumble', 'camera', 'cameraSpeed', 'cameraRadius', 'cameraHeight', 'cameraAlpha', 'cameraTargetX', 'cameraTargetY', 'cameraTargetZ', 'cameraFov', 'textFont', 'textDistance', 'textSize', 'textOutlineType', 'textOutlineColor', 'textOutlineWidth', 'textColor', 'textShading', 'textBackdrop', 'textAnimType', 'textAnimSpeed', 'textAnimIntensity', 'textDisplayPattern', 'textFaceCamera', 'auxFont', 'auxDistance', 'auxSize', 'auxOutlineType', 'auxOutlineColor', 'auxOutlineWidth', 'auxColor', 'auxShading', 'auxBackdrop', 'auxAnimType', 'auxAnimSpeed', 'auxAnimIntensity', 'auxDisplayPattern', 'binaural', 'metronome', 'carrierFreq', 'beatFreq', 'ampModulation', 'audioUrl', 'speech_synth', 'speech_voice', 'speech_speed'];
    
    for (const key of keys) {
      if (c[key] !== undefined && (index === 0 || c[key] !== (lastConfig as any)[key])) {
        if (key === 'palette' && Array.isArray(c[key])) {
          configStr += `${key}: ${c[key].join(',')}\n`;
        } else {
          configStr += `${key}: ${c[key]}\n`;
        }
      }
    }
    
    if (configStr.length > 0) {
      md += '\`\`\`config\n' + configStr + '\`\`\`\n\n';
    }
    
    lastConfig = { ...c };
    
    md += seg.rawMarkdown.trim() + '\n';
    return md;
  }).join('\n');
}

/**
 * Minifies the markdown by removing extra whitespace and redundant configuration.
 * Uses aggressive substitution for keys and common values.
 */
export function minifyMarkdown(markdown: string): string {
  const segments = parseTimeline(markdown);
  let lastConfig: Partial<SegmentConfig> = {};
  
  return segments.map((seg, index) => {
    let md = '';
    if (index > 0) {
      md += '§\n'; // separator
    }
    
    let configStr = '';
    const c = seg.config as any;
    const keys = ['duration', 'pattern', 'patternType', 'repetitionCount', 'repetitionBasePattern', 'repetitionAnimation', 'clusterCount', 'clusterBasePattern', 'clusterChaos', 'cloudAnimation', 'topologyAmplitude', 'topologyFrequency', 'patternSpeed', 'patternScale', 'patternComplexity', 'palette', 'patternColor1', 'patternColor2', 'patternFaceCamera', 'spiralArms', 'spiralThickness', 'spiralCurvature', 'spiralElasticity', 'patternSpin', 'patternRotation', 'patternTumble', 'baseSpin', 'baseRotation', 'baseTumble', 'camera', 'cameraSpeed', 'cameraRadius', 'cameraHeight', 'cameraAlpha', 'cameraTargetX', 'cameraTargetY', 'cameraTargetZ', 'cameraFov', 'textFont', 'textDistance', 'textSize', 'textOutlineType', 'textOutlineColor', 'textOutlineWidth', 'textColor', 'textShading', 'textBackdrop', 'textAnimType', 'textAnimSpeed', 'textAnimIntensity', 'textDisplayPattern', 'textFaceCamera', 'auxFont', 'auxDistance', 'auxSize', 'auxOutlineType', 'auxOutlineColor', 'auxOutlineWidth', 'auxColor', 'auxShading', 'auxBackdrop', 'auxAnimType', 'auxAnimSpeed', 'auxAnimIntensity', 'auxDisplayPattern', 'binaural', 'metronome', 'carrierFreq', 'beatFreq', 'ampModulation', 'audioUrl', 'speech_synth', 'speech_voice', 'speech_speed'];
    
    for (const key of keys) {
      if (c[key] !== undefined && (index === 0 || c[key] !== (lastConfig as any)[key])) {
        const minKey = KEY_MAP[key] || key;
        let val = c[key];
        if (key === 'palette' && Array.isArray(val)) {
          val = val.join(',');
        }
        const minVal = VALUE_MAP[val] || val;
        configStr += `${minKey}:${minVal}\n`;
      }
    }
    
    if (configStr.length > 0) {
      md += '«\n' + configStr + '»\n';
    }
    
    lastConfig = { ...c };
    
    const segmentMd = seg.rawMarkdown
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n');
      
    md += segmentMd;
    return md;
  }).join('\n');
}

/**
 * Reverses the aggressive minification to restore the original markdown format.
 */
export function unminifyMarkdown(minified: string): string {
  if (!minified) return '';
  
  // Reverse the mappings
  const REVERSE_KEY_MAP = Object.fromEntries(Object.entries(KEY_MAP).map(([k, v]) => [v, k]));
  const REVERSE_VALUE_MAP = Object.fromEntries(Object.entries(VALUE_MAP).map(([k, v]) => [v, k]));

  // Split by segments first to avoid global replacement issues
  const segments = minified.split(/^§$/gm);
  
  return segments.map(seg => {
    let segment = seg.trim();
    
    // Handle config blocks
    const configMatch = segment.match(/^«\s*[\r\n]+([\s\S]*?)[\r\n]+»/);
    if (configMatch) {
      const configLines = configMatch[1].split(/[\r\n]+/);
      const expandedLines = configLines.map(line => {
        const [key, ...valueParts] = line.split(':');
        if (key && valueParts.length > 0) {
          const val = valueParts.join(':').trim();
          const expandedKey = REVERSE_KEY_MAP[key.trim()] || key.trim();
          const expandedVal = REVERSE_VALUE_MAP[val] || val;
          return `${expandedKey}: ${expandedVal}`;
        }
        return line;
      });
      
      const expandedConfig = '```config\n' + expandedLines.join('\n') + '\n```';
      segment = segment.replace(configMatch[0], expandedConfig);
    }
    
    return segment;
  }).join('\n\n---\n\n');
}
