import React, { useEffect, useRef, useState } from 'react';

interface WrappedTextProps {
  text: string;
  isPrevious?: boolean;
}

export function WrappedText({ text, isPrevious }: WrappedTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [maxChars, setMaxChars] = useState<number>(80);

  useEffect(() => {
    const compute = () => {
      const el = containerRef.current;
      if (!el) return;
      const width = el.getBoundingClientRect().width || 640;
      const probe = document.createElement('span');
      probe.style.visibility = 'hidden';
      probe.style.position = 'absolute';
      probe.style.whiteSpace = 'pre';
      probe.className = 'font-mono text-sm';
      probe.textContent = 'MMMMMMMMMM';
      el.appendChild(probe);
      const probeWidth = probe.getBoundingClientRect().width || 80;
      el.removeChild(probe);
      const charWidth = Math.max(4, probeWidth / 10);
      const next = Math.max(10, Math.floor(width / charWidth));
      setMaxChars(next);
    };
    compute();
    const ro = new ResizeObserver(() => compute());
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener('resize', compute);
    return () => {
      try { if (containerRef.current) ro.unobserve(containerRef.current); } catch {}
      ro.disconnect();
      window.removeEventListener('resize', compute);
    };
  }, [text]);

  function wrapTextToLines(src: string, maxCharsPerLine = 80): string[] {
    if (!src) return [""]; 
    const lines: string[] = [];
    let index = 0;
    while (index < src.length) {
      const remaining = src.length - index;
      const take = Math.min(maxCharsPerLine, remaining);
      let slice = src.slice(index, index + take);
      if (index + take < src.length) {
        const lastSpace = slice.lastIndexOf(' ');
        if (lastSpace > 0) {
          lines.push(slice.slice(0, lastSpace));
          index += lastSpace + 1;
        } else {
          const marker = ' ..';
          const hardLen = Math.max(1, maxCharsPerLine - marker.length);
          const cut = index + hardLen;
          lines.push(src.slice(index, cut) + marker);
          index = cut;
        }
      } else {
        lines.push(slice);
        break;
      }
    }
    return lines;
  }

  const lines = wrapTextToLines(text, maxChars);
  return (
    <div ref={containerRef} className={`text-sm font-mono whitespace-pre-wrap break-words w-full ${isPrevious ? 'opacity-50' : ''}`}>
      {lines.map((ln, i) => (
        <div key={i}>{ln}</div>
      ))}
    </div>
  );
}


