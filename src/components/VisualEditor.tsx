import React, { useState } from 'react';
import { TimelineSegment, SegmentConfig } from '../timelineParser';
import { Trash2, Plus, ArrowUp, ArrowDown, Upload, ChevronDown, ChevronRight } from 'lucide-react';

interface VisualEditorProps {
  segments: TimelineSegment[];
  onChange: (segments: TimelineSegment[]) => void;
}

interface SegmentEditorProps {
  seg: TimelineSegment;
  index: number;
  totalSegments: number;
  updateConfig: (index: number, key: keyof SegmentConfig, value: any) => void;
  updateText: (index: number, text: string) => void;
  moveSegment: (index: number, dir: number) => void;
  removeSegment: (index: number) => void;
}

function SegmentEditor({ seg, index, totalSegments, updateConfig, updateText, moveSegment, removeSegment }: SegmentEditorProps) {
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isAdvancedAnimOpen, setIsAdvancedAnimOpen] = useState(false);
  const [isAdvancedCamOpen, setIsAdvancedCamOpen] = useState(false);
  const [isAdvancedTextOpen, setIsAdvancedTextOpen] = useState(false);
  const [isAdvancedTextAnimOpen, setIsAdvancedTextAnimOpen] = useState(false);
  const [isAdvancedAudioOpen, setIsAdvancedAudioOpen] = useState(false);

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 flex flex-col gap-4 relative group">
      <div className="flex justify-between items-center">
        <span className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Segment {index + 1}</span>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => moveSegment(index, -1)} disabled={index === 0} className="p-1 text-zinc-400 hover:text-white disabled:opacity-30"><ArrowUp size={16}/></button>
          <button onClick={() => moveSegment(index, 1)} disabled={index === totalSegments - 1} className="p-1 text-zinc-400 hover:text-white disabled:opacity-30"><ArrowDown size={16}/></button>
          <button onClick={() => removeSegment(index)} className="p-1 text-red-400 hover:text-red-300 ml-2"><Trash2 size={16}/></button>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-zinc-500">Text (Markdown)</label>
        <textarea 
          value={seg.text} 
          onChange={(e) => updateText(index, e.target.value)}
          className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 min-h-[100px] resize-y font-mono"
        />
      </div>

      <div className="border border-zinc-800 rounded-lg overflow-hidden">
        <button 
          onClick={() => setIsConfigOpen(!isConfigOpen)}
          className="w-full flex items-center justify-between p-3 bg-zinc-900/50 hover:bg-zinc-900 text-sm font-medium text-zinc-300 transition-colors"
        >
          <span>Config</span>
          {isConfigOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        
        {isConfigOpen && (
          <div className="p-4 bg-zinc-950 flex flex-col gap-4 border-t border-zinc-800">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-500">Duration (s)</label>
                <input type="number" value={seg.config.duration} onChange={(e) => updateConfig(index, 'duration', parseFloat(e.target.value) || 0)} className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
              </div>
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
                <label className="text-xs text-zinc-500">Camera</label>
                <select value={seg.config.camera} onChange={(e) => updateConfig(index, 'camera', e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500">
                  <option value="static">Static</option>
                  <option value="orbit">Orbit</option>
                  <option value="fly">Fly</option>
                  <option value="pan">Pan</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-500">Camera Speed</label>
                <input type="number" step="0.1" value={seg.config.cameraSpeed ?? 1.0} onChange={(e) => updateConfig(index, 'cameraSpeed', parseFloat(e.target.value) || 0)} className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
              </div>
              <div className="flex flex-col gap-1">
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
                      <label className="text-xs text-zinc-500">Pattern Speed</label>
                      <input type="number" step="0.1" value={seg.config.patternSpeed ?? 1.0} onChange={(e) => updateConfig(index, 'patternSpeed', parseFloat(e.target.value) || 0)} className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-zinc-500">Pattern Scale</label>
                      <input type="number" step="0.1" value={seg.config.patternScale ?? 1.0} onChange={(e) => updateConfig(index, 'patternScale', parseFloat(e.target.value) || 0)} className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-zinc-500">Complexity</label>
                      <input type="number" step="1" value={seg.config.patternComplexity ?? 1} onChange={(e) => updateConfig(index, 'patternComplexity', parseFloat(e.target.value) || 0)} className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-zinc-500">Color 1 (Hex)</label>
                      <input type="text" value={seg.config.patternColor1 || ''} onChange={(e) => updateConfig(index, 'patternColor1', e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500" placeholder="#ffffff" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-zinc-500">Color 2 (Hex)</label>
                      <input type="text" value={seg.config.patternColor2 || ''} onChange={(e) => updateConfig(index, 'patternColor2', e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500" placeholder="#ffffff" />
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

            <div className="border border-zinc-800 rounded-lg overflow-hidden mt-2">
              <button 
                onClick={() => setIsAdvancedTextOpen(!isAdvancedTextOpen)}
                className="w-full flex items-center justify-between p-3 bg-zinc-900/30 hover:bg-zinc-900/80 text-sm font-medium text-zinc-400 transition-colors"
              >
                <span>Advanced Text</span>
                {isAdvancedTextOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
              
              {isAdvancedTextOpen && (
                <div className="p-4 bg-zinc-950 flex flex-col gap-4 border-t border-zinc-800">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-zinc-500">Font</label>
                      <select value={seg.config.textFont || 'sans-serif'} onChange={(e) => updateConfig(index, 'textFont', e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500">
                        <option value="sans-serif">Sans-Serif</option>
                        <option value="serif">Serif</option>
                        <option value="monospace">Monospace</option>
                        <option value="cursive">Cursive</option>
                        <option value="fantasy">Fantasy</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-zinc-500">Distance</label>
                      <input type="number" step="1" value={seg.config.textDistance ?? 10} onChange={(e) => updateConfig(index, 'textDistance', parseFloat(e.target.value) || 10)} className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-zinc-500">Size</label>
                      <input type="number" step="1" value={seg.config.textSize ?? 100} onChange={(e) => updateConfig(index, 'textSize', parseFloat(e.target.value) || 100)} className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-zinc-500">Outline</label>
                      <select value={seg.config.textOutline || 'rainbow'} onChange={(e) => updateConfig(index, 'textOutline', e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500">
                        <option value="rainbow">Rainbow</option>
                        <option value="none">None</option>
                        <option value="black">Black</option>
                        <option value="white">White</option>
                        <option value="#ff0000">Red</option>
                        <option value="#00ff00">Green</option>
                        <option value="#0000ff">Blue</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-zinc-500">Shading</label>
                      <select value={seg.config.textShading ? 'true' : 'false'} onChange={(e) => updateConfig(index, 'textShading', e.target.value === 'true')} className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500">
                        <option value="false">Off</option>
                        <option value="true">On</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-zinc-500">Backdrop</label>
                      <select value={seg.config.textBackdrop ? 'true' : 'false'} onChange={(e) => updateConfig(index, 'textBackdrop', e.target.value === 'true')} className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500">
                        <option value="false">Off</option>
                        <option value="true">On</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="border border-zinc-800 rounded-lg overflow-hidden mt-2">
              <button 
                onClick={() => setIsAdvancedTextAnimOpen(!isAdvancedTextAnimOpen)}
                className="w-full flex items-center justify-between p-3 bg-zinc-900/30 hover:bg-zinc-900/80 text-sm font-medium text-zinc-400 transition-colors"
              >
                <span>Advanced Text Animation</span>
                {isAdvancedTextAnimOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
              
              {isAdvancedTextAnimOpen && (
                <div className="p-4 bg-zinc-950 flex flex-col gap-4 border-t border-zinc-800">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-zinc-500">Animation Type</label>
                      <select value={seg.config.textAnimType || 'none'} onChange={(e) => updateConfig(index, 'textAnimType', e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500">
                        <option value="none">None</option>
                        <option value="zoom">Zoom</option>
                        <option value="fade">Fade</option>
                        <option value="float">Float</option>
                        <option value="warp">Warp</option>
                        <option value="prism">Prism</option>
                        <option value="glitch">Glitch</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-zinc-500">Speed</label>
                      <input type="number" step="0.1" value={seg.config.textAnimSpeed ?? 1.0} onChange={(e) => updateConfig(index, 'textAnimSpeed', parseFloat(e.target.value) || 0)} className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-zinc-500">Intensity</label>
                      <input type="number" step="0.1" value={seg.config.textAnimIntensity ?? 1.0} onChange={(e) => updateConfig(index, 'textAnimIntensity', parseFloat(e.target.value) || 0)} className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="border border-zinc-800 rounded-lg overflow-hidden mt-2">
              <button 
                onClick={() => setIsAdvancedAudioOpen(!isAdvancedAudioOpen)}
                className="w-full flex items-center justify-between p-3 bg-zinc-900/30 hover:bg-zinc-900/80 text-sm font-medium text-zinc-400 transition-colors"
              >
                <span>Advanced Audio</span>
                {isAdvancedAudioOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
              
              {isAdvancedAudioOpen && (
                <div className="p-4 bg-zinc-950 flex flex-col gap-4 border-t border-zinc-800">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-zinc-500">Metronome (BPM)</label>
                    <input type="number" value={seg.config.metronome} onChange={(e) => updateConfig(index, 'metronome', parseFloat(e.target.value) || 0)} className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                  </div>

                  <div className="grid grid-cols-3 gap-4 pt-2 border-t border-zinc-800">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-zinc-500">Carrier Freq (Hz)</label>
                      <input type="number" value={seg.config.carrierFreq || 200} onChange={(e) => updateConfig(index, 'carrierFreq', parseFloat(e.target.value) || 0)} className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-zinc-500">Beat Freq (Hz)</label>
                      <input type="number" value={seg.config.beatFreq || 10} onChange={(e) => updateConfig(index, 'beatFreq', parseFloat(e.target.value) || 0)} className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-zinc-500">Amp Mod (Hz)</label>
                      <input type="number" value={seg.config.ampModulation || 0} onChange={(e) => updateConfig(index, 'ampModulation', parseFloat(e.target.value) || 0)} className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1 pt-2 border-t border-zinc-800">
                    <label className="text-xs text-zinc-500">Custom Audio URL</label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="https://... or drop an audio file anywhere"
                        value={seg.config.audioUrl || ''} 
                        onChange={(e) => updateConfig(index, 'audioUrl', e.target.value)} 
                        className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500" 
                      />
                      <label className="flex items-center justify-center px-3 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg cursor-pointer transition-colors text-zinc-300">
                        <Upload size={16} />
                        <input 
                          type="file" 
                          accept="audio/*" 
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

  const updateText = (index: number, text: string) => {
    const newSegments = [...segments];
    newSegments[index] = { ...newSegments[index], text };
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
    newSegments.push({
      id: `seg-${Date.now()}`,
      config: { ...lastConfig },
      text: '# New Segment\nAdd your text here.'
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
          updateText={updateText}
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
