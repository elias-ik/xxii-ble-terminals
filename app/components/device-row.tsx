import React from 'react';
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/components/ui/hover-card';

interface DeviceRowProps {
  id: string;
  isSelected: boolean;
  statusColor: string;
  statusTitle: string;
  shownName: string;
  fullName: string;
  isTruncated: boolean;
  addressShown: string;
  rssi: number;
  rssiColor: string;
  rssiStrength: string;
  connectionBadge: React.ReactNode;
  accessibleLabel: string;
  onSelect: (deviceId: string) => void;
  'data-testid'?: string;
}

export const DeviceRow: React.FC<DeviceRowProps> = React.memo(function DeviceRow({
  id,
  isSelected,
  statusColor,
  statusTitle,
  shownName,
  fullName,
  isTruncated,
  addressShown,
  rssi,
  rssiColor,
  rssiStrength,
  connectionBadge,
  accessibleLabel,
  onSelect,
  'data-testid': dataTestId,
}) {
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(id);
    }
  };

  return (
    <div
      className={`px-2 py-1 border-b cursor-pointer select-none ${
        isSelected ? 'bg-primary/10' : 'hover:bg-muted/50'
      }`}
      onClick={() => onSelect(id)}
      onKeyDown={onKeyDown}
      tabIndex={0}
      role="button"
      aria-label={accessibleLabel}
      aria-pressed={isSelected}
      data-testid={dataTestId}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: statusColor }}
            role="img"
            aria-label={`Status: ${statusTitle}`}
            title={statusTitle}
          />
          <HoverCard openDelay={150}>
            <HoverCardTrigger asChild>
              <span className="font-medium text-[13px] cursor-default">
                {shownName}
              </span>
            </HoverCardTrigger>
            {isTruncated && (
              <HoverCardContent side="top" align="start" className="max-w-xs">
                <div className="text-sm break-words">{fullName}</div>
              </HoverCardContent>
            )}
          </HoverCard>
          <div className="ml-auto flex items-center gap-2">
            {connectionBadge}
          </div>
        </div>
        <div className="mt-0.5 flex items-center justify-between text-[11px] text-muted-foreground leading-tight">
          <span className="font-mono">{addressShown}</span>
          <span className="flex items-center gap-1">
            <span className={rssiColor}>{rssi}dBm</span>
            <span>({rssiStrength})</span>
          </span>
        </div>
      </div>
    </div>
  );
});


