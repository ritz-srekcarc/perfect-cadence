import React, { useState, useEffect } from 'react';
import { X, Share2, Copy, Check, Link as LinkIcon, QrCode, Loader2, ExternalLink, Lock, Unlock } from 'lucide-react';
import CryptoJS from 'crypto-js';
import LZString from 'lz-string';
import { minifyMarkdown } from '../timelineParser';

interface ShareFlyoutProps {
  isOpen: boolean;
  onClose: () => void;
  markdown: string;
}

export function ShareFlyout({ isOpen, onClose, markdown }: ShareFlyoutProps) {
  const [shortUrl, setShortUrl] = useState('');
  const [isShortening, setIsShortening] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [showQr, setShowQr] = useState(false);
  const [password, setPassword] = useState('');
  const [isEncrypted, setIsEncrypted] = useState(false);
  const [shareUrl, setShareUrl] = useState('');

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const generateUrl = () => {
    try {
      const url = new URL(window.location.origin + window.location.pathname);
      const minifiedMarkdown = minifyMarkdown(markdown);
      if (isEncrypted && password) {
        const encrypted = CryptoJS.AES.encrypt(minifiedMarkdown, password).toString();
        url.searchParams.set('e', encrypted);
      } else {
        const compressed = LZString.compressToEncodedURIComponent(minifiedMarkdown);
        url.searchParams.set('m', compressed);
      }
      return url.toString();
    } catch (e) {
      console.error("Failed to generate URL", e);
      return window.location.href;
    }
  };

  useEffect(() => {
    if (isOpen) {
      setShareUrl(generateUrl());
    }
  }, [isOpen, isEncrypted, password, markdown]);

  const shortenUrl = async () => {
    const currentUrl = generateUrl();
    if (currentUrl.length > 5000) {
      setError('The experience link is too long for shortening (max 5000 characters). Please simplify your timeline or use the full link.');
      return;
    }

    setIsShortening(true);
    setError('');
    try {
      const response = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(currentUrl)}`);
      if (!response.ok) throw new Error('Failed to shorten URL');
      const data = await response.text();
      setShortUrl(data);
    } catch (err: any) {
      console.error(err);
      setError('Could not shorten URL. The original link is still available.');
    } finally {
      setIsShortening(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setShortUrl('');
      setError('');
      setShowQr(false);
      setPassword('');
      setIsEncrypted(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const qrCodeUrl = shortUrl 
    ? `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(shortUrl)}`
    : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-950">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold">
            <Share2 size={20} />
            <span>Share Experience</span>
          </div>
          <button onClick={onClose} className="p-1 text-zinc-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-6">
          {/* Encryption Toggle */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium text-zinc-300">
                {isEncrypted ? <Lock size={16} className="text-amber-400" /> : <Unlock size={16} className="text-zinc-500" />}
                <span>Encrypt with Password</span>
              </div>
              <button 
                onClick={() => setIsEncrypted(!isEncrypted)}
                className={`w-10 h-5 rounded-full transition-colors relative ${isEncrypted ? 'bg-emerald-500' : 'bg-zinc-700'}`}
              >
                <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${isEncrypted ? 'left-6' : 'left-1'}`} />
              </button>
            </div>
            
            {isEncrypted && (
              <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
                <input 
                  type="password"
                  placeholder="Enter secret key..."
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <p className="text-[10px] text-zinc-500 italic">
                  Anyone with this link will need this password to view the experience.
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Experience Link</label>
            <div className="flex gap-2">
              <input 
                type="text" 
                readOnly
                value={shareUrl}
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-400 focus:outline-none"
              />
              <button 
                onClick={() => handleCopy(shareUrl)}
                className="p-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition-colors"
                title="Copy link"
              >
                {copied && !shortUrl ? <Check size={18} className="text-emerald-400" /> : <Copy size={18} />}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {!shortUrl ? (
              <div className="flex flex-col gap-2">
                <button 
                  onClick={shortenUrl}
                  disabled={isShortening}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20"
                >
                  {isShortening ? <Loader2 size={18} className="animate-spin" /> : <LinkIcon size={18} />}
                  {isShortening ? 'Shortening...' : 'Get Shortened Link (TinyURL)'}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Short Link</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      readOnly
                      value={shortUrl}
                      className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-emerald-400 font-medium focus:outline-none"
                    />
                    <button 
                      onClick={() => handleCopy(shortUrl)}
                      className="p-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition-colors"
                      title="Copy short link"
                    >
                      {copied ? <Check size={18} className="text-emerald-400" /> : <Copy size={18} />}
                    </button>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button 
                    onClick={() => setShowQr(!showQr)}
                    className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    <QrCode size={16} />
                    {showQr ? 'Hide QR Code' : 'Show QR Code'}
                  </button>
                  <a 
                    href={shortUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition-colors flex items-center justify-center"
                  >
                    <ExternalLink size={16} />
                  </a>
                </div>

                {showQr && (
                  <div className="flex flex-col items-center gap-4 p-4 bg-white rounded-2xl">
                    <img 
                      src={qrCodeUrl} 
                      alt="QR Code" 
                      className="w-48 h-48"
                      referrerPolicy="no-referrer"
                    />
                    <div className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold">Scan to open experience</div>
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="text-xs text-red-400 bg-red-400/10 p-3 rounded-lg border border-red-400/20">
                {error}
              </div>
            )}
          </div>

          <div className="text-[10px] text-zinc-600 text-center uppercase tracking-widest">
            {isEncrypted ? 'Link is encrypted with your secret key' : 'Links contain the entire experience state'}
          </div>
        </div>
      </div>
    </div>
  );
}
