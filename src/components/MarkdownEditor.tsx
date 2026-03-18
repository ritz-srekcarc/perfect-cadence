import React, { useEffect, useRef, useState } from 'react';
import Editor, { useMonaco, Monaco, loader } from '@monaco-editor/react';
import { Loader2 } from 'lucide-react';

// Preload Monaco as soon as this module is evaluated to speed up initial load
loader.init();

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
}

const CONFIG_KEYS = [
  'duration', 'pattern', 'patternType', 'patternSpeed', 'patternScale', 'patternComplexity',
  'patternColor1', 'patternColor2', 'patternFaceCamera', 'camera', 'cameraSpeed', 'cameraRadius',
  'cameraHeight', 'cameraTargetX', 'cameraTargetY', 'cameraTargetZ', 'cameraFov', 'textFont',
  'textDistance', 'textSize', 'textOutlineType', 'textOutlineColor', 'textColor', 'textShading',
  'textBackdrop', 'textAnimType', 'textAnimSpeed', 'textAnimIntensity', 'textDisplayPattern',
  'textFaceCamera', 'auxFont', 'auxDistance', 'auxSize', 'auxOutlineType', 'auxOutlineColor',
  'auxColor', 'auxShading', 'auxBackdrop', 'auxAnimType', 'auxAnimSpeed', 'auxAnimIntensity',
  'auxDisplayPattern', 'binaural', 'metronome', 'carrierFreq', 'beatFreq', 'ampModulation',
  'audioUrl', 'speech_synth', 'speech_voice', 'speech_speed'
];

let isMonacoConfigured = false;

function configureMonaco(monaco: Monaco) {
  if (isMonacoConfigured) return;
  isMonacoConfigured = true;

  // Register custom language
  monaco.languages.register({ id: 'perfect-cadence' });

  // Syntax Highlighting
  monaco.languages.setMonarchTokensProvider('perfect-cadence', {
    tokenizer: {
      root: [
        [/^---$/, 'keyword.separator'],
        [/^```config/, { token: 'keyword.config', next: '@configBlock' }],
        [/^#.*$/, 'markup.heading'],
        [/\*\*.*\*\*/, 'markup.bold'],
        [/\*.*\*/, 'markup.italic'],
        [/^>.*$/, 'markup.quote'],
        [/\[.*\]\(.*\)/, 'markup.link'],
        [/!\[.*\]\(.*\)/, 'markup.image'],
      ],
      configBlock: [
        [/^```$/, { token: 'keyword.config', next: '@pop' }],
        [/([a-zA-Z0-9_]+)(\s*:\s*)(.*)/, ['variable.name', 'delimiter', 'string.value']],
      ]
    }
  });

  // Define Theme
  monaco.editor.defineTheme('solarized-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'keyword.separator', foreground: '2aa198', fontStyle: 'bold' }, // cyan
      { token: 'keyword.config', foreground: '859900', fontStyle: 'bold' }, // green
      { token: 'variable.name', foreground: '268bd2' }, // blue
      { token: 'string.value', foreground: '2aa198' }, // cyan
      { token: 'markup.heading', foreground: 'b58900', fontStyle: 'bold' }, // yellow
      { token: 'markup.bold', fontStyle: 'bold', foreground: 'dc322f' }, // red
      { token: 'markup.italic', fontStyle: 'italic', foreground: 'd33682' }, // magenta
      { token: 'markup.quote', foreground: '586e75', fontStyle: 'italic' }, // base01
      { token: 'markup.link', foreground: '268bd2' }, // blue
      { token: 'markup.image', foreground: '6c71c4' }, // violet
    ],
    colors: {
      'editor.background': '#002b36',
      'editor.foreground': '#839496',
      'editor.lineHighlightBackground': '#073642',
      'editorCursor.foreground': '#839496',
      'editorWhitespace.foreground': '#073642',
      'editorIndentGuide.background': '#073642',
      'editorIndentGuide.activeBackground': '#586e75',
      'editor.selectionBackground': '#073642',
    }
  });

  // Autocomplete & Snippets
  monaco.languages.registerCompletionItemProvider('perfect-cadence', {
    provideCompletionItems: (model, position) => {
      const fullText = model.getValue();
      const lines = fullText.split('\n');
      let inConfig = false;
      
      for (let i = 0; i < position.lineNumber - 1; i++) {
        const line = lines[i].trim();
        if (line === '```config') inConfig = true;
        if (line === '```') inConfig = false;
      }

      const suggestions: any[] = [];

      if (inConfig) {
        // Suggest config keys
        CONFIG_KEYS.forEach(key => {
          suggestions.push({
            label: key,
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: `${key}: `,
            documentation: `Configuration property: ${key}`,
            range: {
              startLineNumber: position.lineNumber,
              endLineNumber: position.lineNumber,
              startColumn: 1,
              endColumn: position.column
            }
          });
        });
      } else {
        // Suggest snippets outside config
        suggestions.push({
          label: 'config',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: [
            '```config',
            'duration: 5',
            'pattern: spiral',
            'camera: orbit',
            '```'
          ].join('\n'),
          documentation: 'Insert a new configuration block',
          range: {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: 1,
            endColumn: position.column
          }
        });
        
        suggestions.push({
          label: 'segment',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: [
            '---',
            '',
            '```config',
            'duration: 5',
            '```',
            '',
            'New segment text here.'
          ].join('\n'),
          documentation: 'Insert a new timeline segment',
          range: {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: 1,
            endColumn: position.column
          }
        });
      }

      return { suggestions };
    }
  });

  // Folding ranges for config blocks and segments
  monaco.languages.registerFoldingRangeProvider('perfect-cadence', {
    provideFoldingRanges: (model, context, token) => {
      const ranges: any[] = [];
      const lines = model.getValue().split('\n');
      
      let configStart = -1;
      let segmentStart = 1;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (line === '```config') {
          configStart = i + 1;
        } else if (line === '```' && configStart !== -1) {
          ranges.push({
            start: configStart,
            end: i + 1,
            kind: monaco.languages.FoldingRangeKind.Region
          });
          configStart = -1;
        } else if (line === '---') {
          if (i > 0) {
            ranges.push({
              start: segmentStart,
              end: i,
              kind: monaco.languages.FoldingRangeKind.Region
            });
          }
          segmentStart = i + 2; // Start after the separator
        }
      }
      
      // Add the last segment
      if (segmentStart < lines.length) {
        ranges.push({
          start: segmentStart,
          end: lines.length,
          kind: monaco.languages.FoldingRangeKind.Region
        });
      }

      return ranges;
    }
  });
}

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({ value, onChange }) => {
  const monaco = useMonaco();
  const editorRef = useRef<any>(null);

  // Syntax Error Highlighting
  useEffect(() => {
    if (!monaco || !editorRef.current) return;

    const model = editorRef.current.getModel();
    if (!model) return;

    const validate = () => {
      const markers: any[] = [];
      const lines = model.getValue().split('\n');
      
      let inConfig = false;
      let configStartLine = -1;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (line === '```config') {
          if (inConfig) {
            markers.push({
              severity: monaco.MarkerSeverity.Error,
              startLineNumber: i + 1,
              startColumn: 1,
              endLineNumber: i + 1,
              endColumn: line.length + 1,
              message: 'Nested config blocks are not allowed. Missing closing ```.'
            });
          }
          inConfig = true;
          configStartLine = i + 1;
        } else if (line === '```') {
          if (!inConfig) {
            markers.push({
              severity: monaco.MarkerSeverity.Error,
              startLineNumber: i + 1,
              startColumn: 1,
              endLineNumber: i + 1,
              endColumn: line.length + 1,
              message: 'Closing ``` without an opening ```config.'
            });
          }
          inConfig = false;
        } else if (inConfig && line.length > 0) {
          // Validate config key
          const match = line.match(/^([a-zA-Z0-9_]+)\s*:/);
          if (match) {
            const key = match[1];
            if (!CONFIG_KEYS.includes(key)) {
              markers.push({
                severity: monaco.MarkerSeverity.Warning,
                startLineNumber: i + 1,
                startColumn: 1,
                endLineNumber: i + 1,
                endColumn: key.length + 1,
                message: `Unknown configuration key: '${key}'`
              });
            }
          } else if (!line.startsWith('//') && !line.startsWith('#')) {
            markers.push({
              severity: monaco.MarkerSeverity.Error,
              startLineNumber: i + 1,
              startColumn: 1,
              endLineNumber: i + 1,
              endColumn: line.length + 1,
              message: 'Invalid configuration format. Expected "key: value".'
            });
          }
        }
      }

      if (inConfig) {
        markers.push({
          severity: monaco.MarkerSeverity.Error,
          startLineNumber: configStartLine,
          startColumn: 1,
          endLineNumber: configStartLine,
          endColumn: 10,
          message: 'Unclosed config block. Missing closing ```.'
        });
      }

      monaco.editor.setModelMarkers(model, 'perfect-cadence', markers);
    };

    // Validate initially and on change
    validate();
    const disposable = model.onDidChangeContent(() => {
      validate();
    });

    return () => disposable.dispose();
  }, [monaco, value]);

  return (
    <Editor
      height="100%"
      language="perfect-cadence"
      theme="solarized-dark"
      beforeMount={configureMonaco}
      value={value}
      loading={
        <div className="flex h-full w-full items-center justify-center bg-[#002b36] text-[#839496]">
          <Loader2 size={32} className="animate-spin" />
          <span className="ml-3 text-sm font-medium">Loading Editor...</span>
        </div>
      }
      onChange={(val) => onChange(val || '')}
      onMount={(editor) => {
        editorRef.current = editor;
      }}
      options={{
        minimap: { enabled: false },
        lineNumbers: 'on',
        folding: true,
        wordWrap: 'on',
        fontFamily: '"JetBrains Mono", "Fira Code", monospace',
        fontSize: 14,
        scrollBeyondLastLine: false,
        smoothScrolling: true,
        cursorBlinking: 'smooth',
        padding: { top: 16, bottom: 16 },
        renderLineHighlight: 'all',
      }}
    />
  );
};
