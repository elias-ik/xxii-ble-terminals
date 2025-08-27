import React from 'react';
import { Button } from '@/components/ui/button';
import { Settings, Trash2 } from 'lucide-react';

interface ConsoleHeaderProps {
  onOpenSettings: () => void;
  onClear: () => void;
}

export function ConsoleHeader({ onOpenSettings, onClear }: ConsoleHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-2">
      <h3 className="text-sm font-medium">Console</h3>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenSettings}
          aria-label="Open settings"
        >
          <Settings className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onClear}
          aria-label="Clear console"
          data-testid="clear-console-button"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Clear
        </Button>
      </div>
    </div>
  );
}


