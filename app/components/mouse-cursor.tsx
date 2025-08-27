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
        "fixed top-0 left-0 w-6 h-6 pointer-events-none z-[9999] transition-transform duration-75 ease-out",
        className
      )}
      style={{
        transform: `translate(${position.x - 12}px, ${position.y - 12}px)`,
      }}
    >
      {/* Cursor pointer */}
      <div className="w-0 h-0 border-l-[8px] border-l-foreground border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent" />
      
      {/* Cursor shadow */}
      <div className="absolute top-[1px] left-[1px] w-0 h-0 border-l-[8px] border-l-muted-foreground/50 border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent" />
      
      {/* Click indicator */}
      <div className="absolute top-1/2 left-1/2 w-2 h-2 bg-primary rounded-full opacity-0 animate-ping" />
    </div>
  );
}
