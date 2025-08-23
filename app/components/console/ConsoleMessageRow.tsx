import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Copy, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { WrappedText } from './WrappedText';

export interface ConsoleMessage {
  id: string;
  direction: 'in' | 'out';
  timestamp: Date;
  rawBytes: Uint8Array;
  renderFormatAtTime: 'HEX' | 'UTF8' | 'ASCII';
  characteristicId: string;
  isPrevious?: boolean;
}

interface ConsoleMessageRowProps {
  message: ConsoleMessage;
  formattedText: string;
  onCopy: (text: string) => void;
  getFormatBadgeColor: (format: string) => string;
  accessibleLabel: string;
}

function getDirectionIcon(direction: 'in' | 'out') {
  return direction === 'out' ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />;
}

function getDirectionColor(direction: 'in' | 'out', isPrevious?: boolean) {
  const baseColor = direction === 'out' ? 'text-blue-600' : 'text-green-600';
  return isPrevious ? `${baseColor} opacity-50` : baseColor;
}

export function ConsoleMessageRow({ message, formattedText, onCopy, getFormatBadgeColor, accessibleLabel }: ConsoleMessageRowProps) {
  return (
    <div
      className={`flex items-start gap-3 p-2 rounded ${
        message.direction === 'out' ? 'bg-blue-50 dark:bg-blue-950/20' : 'bg-green-50 dark:bg-green-950/20'
      } ${message.isPrevious ? 'opacity-50' : ''}`}
      role="log"
      aria-label={accessibleLabel}
    >
      <div className={`flex-shrink-0 ${getDirectionColor(message.direction, message.isPrevious)}`}>
        {getDirectionIcon(message.direction)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-xs ${message.isPrevious ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}>
            {message.timestamp.toLocaleTimeString()}
          </span>
          <Badge variant="secondary" className={`${getFormatBadgeColor(message.renderFormatAtTime)} ${message.isPrevious ? 'opacity-50' : ''}`}>
            {message.renderFormatAtTime}
          </Badge>
          <span className={`text-xs ${message.isPrevious ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}>
            {message.characteristicId}
          </span>
        </div>
        <div className="flex items-start justify-between gap-3 w-full">
          <WrappedText text={formattedText} isPrevious={message.isPrevious} />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onCopy(formattedText)}
            aria-label={`Copy ${message.direction === 'in' ? 'received' : 'sent'} message`}
          >
            <Copy className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}


