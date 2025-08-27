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
      cursorRef.current.style.transform = `translate(${position.x - 36}px, ${position.y - 36}px)`;
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
        transform: `translate(${position.x - 36}px, ${position.y - 36}px)`,
      }}
    >
      {/* Cursor pointer */}
      <div className="w-0 h-0 border-l-[24px] border-l-foreground border-t-[12px] border-t-transparent border-b-[12px] border-b-transparent" />
      
      {/* Cursor shadow */}
      <div className="absolute top-[3px] left-[3px] w-0 h-0 border-l-[24px] border-l-muted-foreground/50 border-t-[12px] border-t-transparent border-b-[12px] border-b-transparent" />
      
      {/* Click indicator */}
      <div className="absolute top-1/2 left-1/2 w-6 h-6 bg-primary rounded-full opacity-0 animate-ping" />
    </div>
  );
}
