import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface MouseCursorProps {
  position: { x: number; y: number };
  visible: boolean;
  className?: string;
}

export function MouseCursor({ position, visible, className }: MouseCursorProps) {
  const cursorRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (cursorRef.current) {
      cursorRef.current.style.transform = `translate(${position.x}px, ${position.y}px)`;
    }
  }, [position]);
  
  if (!visible) return null;
  
  return (
    <div
      ref={cursorRef}
      className={cn(
        "fixed top-0 left-0 w-18 h-18 pointer-events-none z-[9999]",
        className
      )}
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
      }}
    >
      {/* Apple-style cursor using the existing SVG */}
      <img 
        src="/cursor.svg" 
        alt="cursor" 
        className="w-6 h-6"
        style={{ transform: 'scale(1.5)' }}
      />
      
      {/* Click indicator */}
      <div className="absolute top-1/2 left-1/2 w-6 h-6 bg-primary rounded-full opacity-0 animate-ping" />
    </div>
  );
}
