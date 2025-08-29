import React, { useState, useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { 
  MessageSquare, 
  BookOpen,
  Pencil,
  Trash2,
  Settings,
  Copy,
  ArrowUpRight,
  ArrowDownLeft
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useBLEStore } from '@/lib/ble-store';
import { SettingsOverlay } from './settings-overlay';
import { generateAccessibleLabel, useScreenReader } from '@/hooks/use-keyboard-shortcuts';
import { ConsoleHeader } from './console/ConsoleHeader';
import { ConsoleMessageRow } from './console/ConsoleMessageRow';
import { WrappedText } from './console/WrappedText';
import { TerminalSendInput } from './terminal-send-input';

interface TerminalConsoleProps {
  deviceId: string;
}

export function TerminalConsole({ deviceId }: TerminalConsoleProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLElement | null>(null);
  const [shouldStickToBottom, setShouldStickToBottom] = useState<boolean>(true);
  const { announce } = useScreenReader();

  const {
    read,
    write,
    clearConsole,
    getDeviceSettings,
    validateHexInput,
    getDeviceUI,
    setDeviceUI
  } = useBLEStore() as unknown as any;

  // Get console messages and device data
  const state = useBLEStore();
  const consoleMessages = state.consoleBuffers[deviceId] || [];
  const connection = state.connections[deviceId];
  const services = connection?.services || {};
  const deviceUI = getDeviceUI(deviceId);
  const selectedServiceId = deviceUI.selectedServiceId;
  const selectedCharacteristicId = deviceUI.selectedCharacteristicId;
  const writeMode = deviceUI.writeMode;
  const characteristics = selectedServiceId ? Object.values(services[selectedServiceId]?.characteristics || {}) : [];
  const selectedCharacteristic = selectedServiceId && selectedCharacteristicId 
    ? services[selectedServiceId]?.characteristics[selectedCharacteristicId] 
    : null;
  const canWrite = !!(
    writeMode && selectedCharacteristic && (
      (writeMode === 'write' && selectedCharacteristic.capabilities?.write) ||
      (writeMode === 'writeNoResp' && selectedCharacteristic.capabilities?.writeNoResp)
    )
  );

  const deviceSettings = getDeviceSettings(deviceId);
  // Services & Characteristics editor shown in dialog
  const [editorOpen, setEditorOpen] = useState(false);
  // Per-device capability selections (convert arrays to Sets for fast lookup)
  const selectedReadSet = new Set<string>(deviceUI.selectedReadKeys || []);
  const selectedNotifySet = new Set<string>(deviceUI.selectedNotifyKeys || []);
  const selectedIndicateSet = new Set<string>(deviceUI.selectedIndicateKeys || []);

  const makeKey = (svcId: string, chId: string) => `${svcId}:${chId}`;
  const isWriteTarget = (svcId: string, chId: string) => selectedServiceId === svcId && selectedCharacteristicId === chId;

  // Advanced targets & subscriptions
  const [readTarget, setReadTarget] = useState<{ serviceId: string; characteristicId: string } | null>(null);

  // Initialize read target on mount when possible
  useEffect(() => {
    if (!readTarget && selectedServiceId && selectedCharacteristicId) {
      setReadTarget({ serviceId: selectedServiceId, characteristicId: selectedCharacteristicId });
    }
  }, [readTarget, selectedServiceId, selectedCharacteristicId]);

  // Wire scroll listener to Radix ScrollArea viewport (actual scrollable element)
  useEffect(() => {
    const root = scrollAreaRef.current;
    if (!root) return;
    const vp = root.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null;
    viewportRef.current = vp;
    if (!vp) return;
    const onScroll = () => {
      const threshold = 8; // px
      const distanceFromBottom = vp.scrollHeight - (vp.scrollTop + vp.clientHeight);
      setShouldStickToBottom(distanceFromBottom <= threshold);
    };
    vp.addEventListener('scroll', onScroll, { passive: true });
    // Initialize stick-to-bottom
    onScroll();
    return () => {
      vp.removeEventListener('scroll', onScroll);
    };
  }, []);

  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    if (shouldStickToBottom) {
      vp.scrollTop = vp.scrollHeight;
    }
  }, [consoleMessages, shouldStickToBottom]);

  

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    announce('Copied to clipboard', 'polite');
  };

  const formatData = (bytes: Uint8Array, format: 'HEX' | 'UTF8' | 'ASCII') => {
    switch (format) {
      case 'HEX':
        return Array.from(bytes)
          .map(byte => byte.toString(16).padStart(2, '0').toUpperCase())
          .join(' ');
      case 'UTF8': {
        try {
          return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
        } catch {
          return '';
        }
      }
      case 'ASCII': {
        // Automatic escaping: keep printable ASCII (except backslash), escape everything else
        const raw = String.fromCharCode(...bytes);
        return raw.replace(/[\x00-\x1F\x7F-\xFF\\]/g, (ch) => {
          const code = ch.charCodeAt(0);
          if (code === 0x0A) return '\\n';
          if (code === 0x0D) return '\\r';
          if (code === 0x09) return '\\t';
          if (code === 0x5C) return '\\\\'; // backslash
          return '\\x' + code.toString(16).padStart(2, '0').toUpperCase();
        });
      }
      default:
        return '';
    }
  };

  // moved to ConsoleMessageRow

  const getFormatBadgeColor = (format: string) => {
    switch (format) {
      case 'HEX': return 'bg-purple-100 text-purple-800';
      case 'UTF8': return 'bg-blue-100 text-blue-800';
      case 'ASCII': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Wrap long lines: prefer breaking at spaces; otherwise hard-break and append " .." to the upper line
  function wrapTextToLines(text: string, maxCharsPerLine = 80): string[] {
    if (!text) return [""];
    const lines: string[] = [];
    let index = 0;
    while (index < text.length) {
      const remaining = text.length - index;
      const take = Math.min(maxCharsPerLine, remaining);
      let slice = text.slice(index, index + take);

      if (index + take < text.length) {
        const lastSpace = slice.lastIndexOf(' ');
        if (lastSpace > 0) {
          lines.push(slice.slice(0, lastSpace));
          index += lastSpace + 1; // skip the space
        } else {
          // No space in this window; hard break and mark with continuation.
          // Ensure the continuation marker fits on the same line.
          const marker = ' ..';
          const hardLen = Math.max(1, maxCharsPerLine - marker.length);
          const cut = index + hardLen;
          lines.push(text.slice(index, cut) + marker);
          index = cut;
        }
      } else {
        lines.push(slice);
        break;
      }
    }
    return lines;
  }

  // WrappedText moved to separate component

  const getCapabilityBadge = (capability: string) => {
    const colors = {
      read: 'bg-blue-100 text-blue-800',
      write: 'bg-green-100 text-green-800',
      writeNoResp: 'bg-orange-100 text-orange-800',
      notify: 'bg-purple-100 text-purple-800',
      indicate: 'bg-pink-100 text-pink-800'
    };
    
    return (
      <Badge variant="secondary" className={colors[capability as keyof typeof colors] || 'bg-gray-100 text-gray-800'}>
        {capability}
      </Badge>
    );
  };

  const handleCharacteristicSelect = (characteristicId: string) => {
    setDeviceUI(deviceId, { selectedCharacteristicId: characteristicId });
    announce(`Selected characteristic: ${characteristicId}`, 'polite');
  };

  const handleRead = async () => {
    if (!selectedCharacteristicId || !selectedServiceId) return;
    
    try {
      await read(deviceId, selectedServiceId, selectedCharacteristicId);
      announce('Read operation completed', 'polite');
    } catch (error) {
      announce('Read operation failed', 'assertive');
    }
  };

  const handleClearConsole = () => {
    clearConsole(deviceId);
    announce('Console cleared', 'polite');
  };

  const handleServiceSelect = (serviceId: string) => {
    setDeviceUI(deviceId, { selectedServiceId: serviceId, selectedCharacteristicId: null });
    announce(`Selected service: ${serviceId}`, 'polite');
  };

  // Virtualizer for console messages (windowed rendering)
  const rowVirtualizer = useVirtualizer({
    count: consoleMessages.length,
    getScrollElement: () => viewportRef.current as HTMLElement | null,
    estimateSize: () => 96, // closer to average tall row to reduce correction jumps
    overscan: 30,
    getItemKey: (index) => (consoleMessages[index]?.id ?? index),
  });
  const virtualItems = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();
  const ROW_GAP_PX = 8;

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Header removed; settings moved to Console row */}

      <CardContent className="flex-1 flex flex-col gap-4 min-h-0">
        {/* Active Characteristics */}
        <div className="border rounded-md p-3">
          <div className="mb-2 text-sm font-medium flex items-center justify-between">
            <span>Active Characteristics</span>
            {(() => {
              const writeKey = (selectedServiceId && selectedCharacteristicId && writeMode) ? makeKey(selectedServiceId, selectedCharacteristicId) : null;
              const activeKeys = new Set<string>();
              selectedReadSet.forEach((k: string) => activeKeys.add(k));
              selectedNotifySet.forEach((k: string) => activeKeys.add(k));
              selectedIndicateSet.forEach((k: string) => activeKeys.add(k));
              if (writeKey) activeKeys.add(writeKey);
              const hasAny = (() => {
                for (const svc of Object.values(services) as any[]) {
                  for (const ch of Object.values((svc as any).characteristics)) {
                    const key = makeKey((svc as any).uuid, (ch as any).uuid);
                    if (activeKeys.has(key)) return true;
                  }
                }
                return false;
              })();
              return hasAny ? (
                <Button size="sm" variant="outline" className="bg-white text-foreground" onClick={() => setEditorOpen(true)} data-testid="edit-active-characteristics-button">
                  <Pencil className="h-4 w-4 mr-2" /> Edit
                </Button>
              ) : null;
            })()}
          </div>
          <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
            {(() => {
              const writeKey = (selectedServiceId && selectedCharacteristicId && writeMode) ? makeKey(selectedServiceId, selectedCharacteristicId) : null;
              const activeKeys = new Set<string>();
              selectedReadSet.forEach((k: string) => activeKeys.add(k));
              selectedNotifySet.forEach((k: string) => activeKeys.add(k));
              selectedIndicateSet.forEach((k: string) => activeKeys.add(k));
              if (writeKey) activeKeys.add(writeKey);

              const rows: React.ReactElement[] = [];
              Object.values(services).forEach((svc: any) => {
                Object.values(svc.characteristics).forEach((ch: any) => {
                  const key = makeKey(svc.uuid, ch.uuid);
                  if (!activeKeys.has(key)) return;
                  const showRead = selectedReadSet.has(key);
                  const showNotify = selectedNotifySet.has(key);
                  const showIndicate = selectedIndicateSet.has(key);
                  const showWrite = writeKey === key && writeMode === 'write';
                  const showWriteNoResp = writeKey === key && writeMode === 'writeNoResp';
                  // Persist write selection whenever visible badges correspond to current selection
                  if (writeKey === key && (showWrite || showWriteNoResp)) {
                    // best-effort fire and forget
                    (useBLEStore.getState() as any).persistDeviceWriteSelection(deviceId);
                  }
                  rows.push(
                    <div key={key} className="flex items-center justify-between text-sm border rounded-md px-2 py-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="truncate">{ch.name}</span>
                        <Badge variant="outline" className="text-[10px]">{ch.uuid}</Badge>
                        {showRead && <Badge variant="secondary" className="text-[11px] px-2 py-0.5">read</Badge>}
                        {showNotify && <Badge variant="secondary" className="text-[11px] px-2 py-0.5">notify</Badge>}
                        {showIndicate && <Badge variant="secondary" className="text-[11px] px-2 py-0.5">indicate</Badge>}
                        {showWrite && <Badge variant="secondary" className="text-[11px] px-2 py-0.5">write</Badge>}
                        {showWriteNoResp && <Badge variant="secondary" className="text-[11px] px-2 py-0.5">writeNoResp</Badge>}
                      </div>
                      <div className="flex items-center gap-2">
                        {showRead && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="px-2"
                            onClick={() => read(deviceId, svc.uuid, ch.uuid)}
                            data-testid={ch.name === 'Manufacturer Name' ? 'row-read-manufacturer' : (ch.name === 'Model Number' ? 'row-read-model' : undefined)}
                          >
                            <BookOpen className="h-3 w-3 mr-1" /> Read
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" aria-label="Remove" onClick={async () => {
                          const keyToRemove = key;
                          
                          // Check if the characteristic needs to be unsubscribed before removing
                          const wasNotifySelected = (deviceUI.selectedNotifyKeys || []).includes(keyToRemove);
                          const wasIndicateSelected = (deviceUI.selectedIndicateKeys || []).includes(keyToRemove);
                          const shouldUnsubscribe = (wasNotifySelected || wasIndicateSelected) && ch.subscribed;
                          
                          // Unsubscribe first if needed
                          if (shouldUnsubscribe) {
                            try {
                              await (useBLEStore.getState() as any).unsubscribe(deviceId, svc.uuid, ch.uuid);
                            } catch (error) {
                              console.warn('Failed to unsubscribe during removal:', error);
                            }
                          }
                          
                          // Update UI state after unsubscribe
                          const nextReadArr = (deviceUI.selectedReadKeys || []).filter((k: string) => k !== keyToRemove);
                          const nextNotifyArr = (deviceUI.selectedNotifyKeys || []).filter((k: string) => k !== keyToRemove);
                          const nextIndicateArr = (deviceUI.selectedIndicateKeys || []).filter((k: string) => k !== keyToRemove);
                          const isWriteCharacteristic = writeKey === keyToRemove;
                          
                          setDeviceUI(deviceId, { 
                            selectedReadKeys: nextReadArr, 
                            selectedNotifyKeys: nextNotifyArr, 
                            selectedIndicateKeys: nextIndicateArr, 
                            ...(isWriteCharacteristic ? { writeMode: null } : {}) 
                          });
                          
                          // Persist the write selection change if we removed a write characteristic
                          if (isWriteCharacteristic) {
                            try {
                              await (useBLEStore.getState() as any).persistDeviceWriteSelection(deviceId);
                            } catch (error) {
                              console.warn('Failed to persist write selection after removal:', error);
                            }
                          }
                        }}
                        data-testid={ch.name === 'Manufacturer Name'
                          ? 'remove-manufacturer'
                          : (ch.name === 'Model Number'
                            ? 'remove-model'
                            : ((ch.uuid === 'custom-char-1' || ch.name === 'Custom Characteristic 1')
                              ? 'remove-custom-char-1'
                              : undefined))}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                });
              });
              if (rows.length === 0) {
                return (
                  <div className="flex justify-center py-2">
                    <Button size="sm" variant="outline" className="bg-white text-foreground" onClick={() => setEditorOpen(true)} data-testid="edit-active-characteristics-button">
                      <Pencil className="h-4 w-4 mr-2" /> Edit
                    </Button>
                  </div>
                );
              }
              return rows;
            })()}
          </div>
        </div>

        {/* Editor Dialog for Services & Characteristics */}
        <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
          <DialogContent className="sm:max-w-3xl w-full max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>Services & Characteristics</DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[65vh] pr-2">
              <div className="space-y-4">
                {Object.values(services).map((service: any, svcIdx: number, svcArr: any[]) => (
                  <div key={service.uuid} className="pb-2">
                    <div className="font-medium text-sm flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span>{service.name}</span>
                        <Badge variant="outline" className="text-xs font-mono">{service.uuid}</Badge>
                      </div>
                    </div>
                    <div className="mt-2 space-y-1">
                      {Object.values(service.characteristics).map((ch: any) => {
                        const key = makeKey(service.uuid, ch.uuid);
                        const caps = ch.capabilities || {};
                        const writeSelected = isWriteTarget(service.uuid, ch.uuid);
                        return (
                          <div key={key} className="flex items-center justify-between gap-3 text-xs py-1">
                            <div className="min-w-0 flex items-center gap-2">
                              <span className="truncate">{ch.name}</span>
                              <Badge variant="outline" className="text-[10px] font-mono">{ch.uuid}</Badge>
                            </div>
                            <div className="flex gap-1 flex-wrap shrink-0">
                              {caps.read && (
                                <Badge
                                  variant={selectedReadSet.has(key) ? 'default' : 'secondary'}
                                  className="text-[11px] px-2 py-0.5 cursor-pointer"
                                  onClick={() => {
                                    const wasSelected = selectedReadSet.has(key);
                                    const next = new Set<string>(selectedReadSet);
                                    if (wasSelected) next.delete(key); else next.add(key);
                                    setDeviceUI(deviceId, { selectedReadKeys: Array.from(next) as string[] });
                                  }}
                                  data-testid={ch.name === 'Manufacturer Name' ? 'read-manufacturer-name' : (ch.name === 'Model Number' ? 'read-model-number' : undefined)}
                                >
                                  read
                                </Badge>
                              )}
                              {caps.notify && (
                                <Badge
                                  variant={selectedNotifySet.has(key) ? 'default' : 'secondary'}
                                  className="text-[11px] px-2 py-0.5 cursor-pointer"
                                  onClick={async () => {
                                    const next = new Set<string>(selectedNotifySet);
                                    const wasSelected = next.has(key);
                                    if (wasSelected) next.delete(key); else next.add(key);
                                    const willBeSubscribed = next.has(key) || selectedIndicateSet.has(key);
                                    
                                    if (willBeSubscribed && !ch.subscribed) {
                                      try {
                                        await (useBLEStore.getState() as any).subscribe(deviceId, service.uuid, ch.uuid);
                                      } catch (error) {
                                        console.warn('Failed to subscribe:', error);
                                        return; // Don't update UI if subscribe failed
                                      }
                                    }
                                    if (!willBeSubscribed && ch.subscribed) {
                                      try {
                                        await (useBLEStore.getState() as any).unsubscribe(deviceId, service.uuid, ch.uuid);
                                      } catch (error) {
                                        console.warn('Failed to unsubscribe:', error);
                                        return; // Don't update UI if unsubscribe failed
                                      }
                                    }
                                    setDeviceUI(deviceId, { selectedNotifyKeys: Array.from(next) as string[] });
                                  }}
                                  data-testid={ch.uuid === 'custom-char-1' ? 'notify-custom-char-1' : 'subscribe-button'}
                                >
                                  notify
                                </Badge>
                              )}
                              {caps.indicate && (
                                <Badge
                                  variant={selectedIndicateSet.has(key) ? 'default' : 'secondary'}
                                  className="text-[11px] px-2 py-0.5 cursor-pointer"
                                  onClick={async () => {
                                    const next = new Set<string>(selectedIndicateSet);
                                    const wasSelected = next.has(key);
                                    if (wasSelected) next.delete(key); else next.add(key);
                                    const willBeSubscribed = selectedNotifySet.has(key) || next.has(key);
                                    
                                    if (willBeSubscribed && !ch.subscribed) {
                                      try {
                                        await (useBLEStore.getState() as any).subscribe(deviceId, service.uuid, ch.uuid);
                                      } catch (error) {
                                        console.warn('Failed to subscribe:', error);
                                        return; // Don't update UI if subscribe failed
                                      }
                                    }
                                    if (!willBeSubscribed && ch.subscribed) {
                                      try {
                                        await (useBLEStore.getState() as any).unsubscribe(deviceId, service.uuid, ch.uuid);
                                      } catch (error) {
                                        console.warn('Failed to unsubscribe:', error);
                                        return; // Don't update UI if unsubscribe failed
                                      }
                                    }
                                    setDeviceUI(deviceId, { selectedIndicateKeys: Array.from(next) as string[] });
                                  }}
                                >
                                  indicate
                                </Badge>
                              )}
                              {caps.write && (
                                <Badge
                                  variant={writeSelected && writeMode === 'write' ? 'default' : 'secondary'}
                                  className="text-[11px] px-2 py-0.5 cursor-pointer"
                                  onClick={async () => {
                                    if (writeSelected && writeMode === 'write') {
                                      setDeviceUI(deviceId, { writeMode: null });
                                      try {
                                        await (useBLEStore.getState() as any).persistDeviceWriteSelection(deviceId);
                                      } catch (error) {
                                        console.warn('Failed to persist write selection:', error);
                                      }
                                    } else {
                                      setDeviceUI(deviceId, { selectedServiceId: service.uuid, selectedCharacteristicId: ch.uuid, writeMode: 'write' });
                                      try {
                                        await (useBLEStore.getState() as any).persistDeviceWriteSelection(deviceId);
                                      } catch (error) {
                                        console.warn('Failed to persist write selection:', error);
                                      }
                                    }
                                  }}
                                >
                                  write
                                </Badge>
                              )}
                              {caps.writeNoResp && (
                                <Badge
                                  variant={writeSelected && writeMode === 'writeNoResp' ? 'default' : 'secondary'}
                                  className="text-[11px] px-2 py-0.5 cursor-pointer"
                                  onClick={async () => {
                                    if (writeSelected && writeMode === 'writeNoResp') {
                                      setDeviceUI(deviceId, { writeMode: null });
                                      try {
                                        await (useBLEStore.getState() as any).persistDeviceWriteSelection(deviceId);
                                      } catch (error) {
                                        console.warn('Failed to persist write selection:', error);
                                      }
                                    } else {
                                      setDeviceUI(deviceId, { selectedServiceId: service.uuid, selectedCharacteristicId: ch.uuid, writeMode: 'writeNoResp' });
                                      try {
                                        await (useBLEStore.getState() as any).persistDeviceWriteSelection(deviceId);
                                      } catch (error) {
                                        console.warn('Failed to persist write selection:', error);
                                      }
                                    }
                                  }}
                                  data-testid={ch.uuid === 'custom-char-1' ? 'write-no-resp-custom-char-1' : undefined}
                                >
                                  writeNoResp
                                </Badge>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {svcIdx < (svcArr?.length || 0) - 1 && <Separator className="mt-3" />}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>

        <Separator />

        {/* Console Messages */}
        <div className="flex-1 flex flex-col min-h-0">
          <ConsoleHeader onOpenSettings={() => setSettingsOpen(true)} onClear={handleClearConsole} />

          <ScrollArea ref={scrollAreaRef} className="flex-1 min-h-0 border rounded-md p-3 bg-muted/30">
            {consoleMessages.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No messages yet</p>
                <p className="text-xs">Send a message or subscribe to notifications</p>
              </div>
            ) : (
              <div className="relative w-full" style={{ height: totalSize }}>
                {virtualItems.map((vItem) => {
                  const message = consoleMessages[vItem.index];
                  const accessibleLabel = generateAccessibleLabel('console-entry', message);
                  return (
                    <div
                      key={message.id}
                      ref={rowVirtualizer.measureElement}
                      data-index={vItem.index}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${vItem.start}px)`,
                        willChange: 'transform',
                        contain: 'layout paint',
                      }}
                      className=""
                    >
                      <ConsoleMessageRow
                        message={{
                          id: message.id,
                          direction: message.direction,
                          timestamp: message.timestamp,
                          rawBytes: message.rawBytes,
                          renderFormatAtTime: message.renderFormatAtTime,
                          characteristicId: message.characteristicId,
                          isPrevious: message.isPrevious,
                        }}
                        formattedText={formatData(message.rawBytes, message.renderFormatAtTime)}
                        onCopy={(t) => copyToClipboard(t)}
                        getFormatBadgeColor={getFormatBadgeColor}
                        accessibleLabel={accessibleLabel}
                      />
                      {/* Spacer included in measured element for consistent gaps */}
                      <div style={{ height: ROW_GAP_PX }} />
                  </div>
                );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Input Area */}
        <TerminalSendInput
          canWrite={canWrite}
          sendFormat={deviceSettings.sendFormat}
          hexFillerPosition={deviceSettings.hexFillerPosition}
          validateHexInput={validateHexInput}
          onSend={(message: string) => {
            if (!selectedCharacteristicId || !selectedServiceId || !canWrite) return;
            write(deviceId, selectedServiceId, selectedCharacteristicId, message);
            announce('Message sent', 'polite');
          }}
          focusWhenKey={selectedCharacteristicId || null}
        />
      </CardContent>

      {/* Settings Overlay */}
      <SettingsOverlay
        deviceId={deviceId}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      />
    </div>
  );
}
