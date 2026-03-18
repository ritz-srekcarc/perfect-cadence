import { PREBUILT_WORDLISTS } from './timelineParser';

export interface TextToken {
  type: 'text' | 'wordlist';
  content?: string;
  interval?: number;
  count?: number;
  words?: string[];
  url?: string;
  bold: boolean;
  italic: boolean;
}

export interface TextLine {
  headerLevel: number;
  listType: 'bullet' | 'number' | 'none';
  listIndex?: number;
  tokens: TextToken[];
}

export function parseMarkdownText(text: string): TextLine[] {
  const lines = text.split('\n');
  const result: TextLine[] = [];

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    let headerLevel = 0;
    let listType: 'bullet' | 'number' | 'none' = 'none';
    let currentListIndex: number | undefined;

    // Parse header
    const headerMatch = line.match(/^(#{1,6})\s+(.*)/);
    if (headerMatch) {
      headerLevel = headerMatch[1].length;
      line = headerMatch[2];
    }

    // Parse list
    const bulletMatch = line.match(/^[-*+]\s+(.*)/);
    if (bulletMatch) {
      listType = 'bullet';
      line = bulletMatch[1];
    } else {
      const numberMatch = line.match(/^(\d+)\.\s+(.*)/);
      if (numberMatch) {
        listType = 'number';
        currentListIndex = parseInt(numberMatch[1]);
        line = numberMatch[2];
      }
    }

    // Parse inline styles and wordlists
    const tokens: TextToken[] = [];
    
    // Regex to match bold-italic, bold, italic, and wordlists
    // Wordlist: !{interval,count}(words)
    const regex = /(\*\*\*.*?\*\*\*|___.*?___|\*\*.*?\*\*|__.*?__|\*.*?\*|_.*?_|!\{[\d.]+,\s*\d+\}\([^)]+\))/g;
    
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        tokens.push({
          type: 'text',
          content: line.substring(lastIndex, match.index),
          bold: false,
          italic: false
        });
      }

      const tokenStr = match[0];
      if (tokenStr.startsWith('!{')) {
        const wlMatch = tokenStr.match(/!\{([\d.]+),\s*(\d+)\}\(([^)]+)\)/);
        if (wlMatch) {
          const interval = parseFloat(wlMatch[1]);
          const count = parseInt(wlMatch[2]);
          const rawWords = wlMatch[3].trim();
          let words: string[] = [];
          let url: string | undefined;

          if (rawWords.startsWith('http://') || rawWords.startsWith('https://')) {
            url = rawWords;
          } else {
            words = rawWords.split(',').map(w => w.trim()).filter(w => w.length > 0);
            if (words.length === 1 && PREBUILT_WORDLISTS[words[0].toLowerCase()]) {
              words = PREBUILT_WORDLISTS[words[0].toLowerCase()];
            }
          }

          tokens.push({
            type: 'wordlist',
            interval,
            count,
            words,
            url,
            bold: false,
            italic: false
          });
        }
      } else if (tokenStr.startsWith('***') || tokenStr.startsWith('___')) {
        const content = tokenStr.substring(3, tokenStr.length - 3);
        const wlMatch = content.match(/^!\{([\d.]+),\s*(\d+)\}\(([^)]+)\)$/);
        if (wlMatch) {
          const interval = parseFloat(wlMatch[1]);
          const count = parseInt(wlMatch[2]);
          const rawWords = wlMatch[3].trim();
          let words: string[] = [];
          let url: string | undefined;

          if (rawWords.startsWith('http://') || rawWords.startsWith('https://')) {
            url = rawWords;
          } else {
            words = rawWords.split(',').map(w => w.trim()).filter(w => w.length > 0);
            if (words.length === 1 && PREBUILT_WORDLISTS[words[0].toLowerCase()]) {
              words = PREBUILT_WORDLISTS[words[0].toLowerCase()];
            }
          }

          tokens.push({
            type: 'wordlist',
            interval,
            count,
            words,
            url,
            bold: true,
            italic: true
          });
        } else {
          tokens.push({
            type: 'text',
            content,
            bold: true,
            italic: true
          });
        }
      } else if (tokenStr.startsWith('**') || tokenStr.startsWith('__')) {
        const content = tokenStr.substring(2, tokenStr.length - 2);
        const wlMatch = content.match(/^!\{([\d.]+),\s*(\d+)\}\(([^)]+)\)$/);
        if (wlMatch) {
          const interval = parseFloat(wlMatch[1]);
          const count = parseInt(wlMatch[2]);
          const rawWords = wlMatch[3].trim();
          let words: string[] = [];
          let url: string | undefined;

          if (rawWords.startsWith('http://') || rawWords.startsWith('https://')) {
            url = rawWords;
          } else {
            words = rawWords.split(',').map(w => w.trim()).filter(w => w.length > 0);
            if (words.length === 1 && PREBUILT_WORDLISTS[words[0].toLowerCase()]) {
              words = PREBUILT_WORDLISTS[words[0].toLowerCase()];
            }
          }

          tokens.push({
            type: 'wordlist',
            interval,
            count,
            words,
            url,
            bold: true,
            italic: false
          });
        } else {
          tokens.push({
            type: 'text',
            content,
            bold: true,
            italic: false
          });
        }
      } else if (tokenStr.startsWith('*') || tokenStr.startsWith('_')) {
        const content = tokenStr.substring(1, tokenStr.length - 1);
        const wlMatch = content.match(/^!\{([\d.]+),\s*(\d+)\}\(([^)]+)\)$/);
        if (wlMatch) {
          const interval = parseFloat(wlMatch[1]);
          const count = parseInt(wlMatch[2]);
          const rawWords = wlMatch[3].trim();
          let words: string[] = [];
          let url: string | undefined;

          if (rawWords.startsWith('http://') || rawWords.startsWith('https://')) {
            url = rawWords;
          } else {
            words = rawWords.split(',').map(w => w.trim()).filter(w => w.length > 0);
            if (words.length === 1 && PREBUILT_WORDLISTS[words[0].toLowerCase()]) {
              words = PREBUILT_WORDLISTS[words[0].toLowerCase()];
            }
          }

          tokens.push({
            type: 'wordlist',
            interval,
            count,
            words,
            url,
            bold: false,
            italic: true
          });
        } else {
          tokens.push({
            type: 'text',
            content,
            bold: false,
            italic: true
          });
        }
      }

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < line.length) {
      tokens.push({
        type: 'text',
        content: line.substring(lastIndex),
        bold: false,
        italic: false
      });
    }

    result.push({
      headerLevel,
      listType,
      listIndex: currentListIndex,
      tokens
    });
  }

  return result;
}
