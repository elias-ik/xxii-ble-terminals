import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Pause, Settings } from 'lucide-react';
import { MouseCursor } from '@/components/mouse-cursor';
import { useMouseSimulation } from '@/hooks/use-mouse-simulation';
import { isElectron } from '@/lib/env';

export function DemoModeIndicator() {
  const {
    config,
    currentPosition,
    isActive,
    isDemoMode,
    userControlStatus,
    toggleSimulation,
    updateConfig,
  } = useMouseSimulation();
  
  // Don't show in Electron mode
  if (!isDemoMode) return null;
  
  return (
    <>
      {/* Mouse cursor */}
      <MouseCursor
        position={currentPosition}
        visible={config.showCursor && isActive}
        className="transition-opacity duration-200"
      />
      
      {/* Demo mode indicator - only show when user has control */}
      {userControlStatus === 'user' && (
        <div className="fixed top-4 right-4 z-[9998] flex items-center gap-2">
          <Badge 
            variant="secondary" 
            className="bg-yellow-100 text-yellow-800 border-yellow-200"
          >
            Demo Mode
          </Badge>
          
          <Button
            variant="outline"
            size="sm"
            onClick={toggleSimulation}
            className="h-8 px-3"
          >
            {isActive ? (
              <>
                <Pause className="h-3 w-3 mr-1" />
                Pause
              </>
            ) : (
              <>
                <Play className="h-3 w-3 mr-1" />
                Start Demo
              </>
            )}
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => updateConfig({ showCursor: !config.showCursor })}
            className="h-8 px-2"
            title={config.showCursor ? "Hide cursor" : "Show cursor"}
          >
            <Settings className="h-3 w-3" />
          </Button>
        </div>
      )}
    </>
  );
}
