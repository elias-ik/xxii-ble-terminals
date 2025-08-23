import React, { useState, useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Send, 
  Trash2, 
  Copy, 
  Settings, 
  MessageSquare, 
  ArrowUpRight, 
  ArrowDownLeft,
  BookOpen,
  AlertTriangle,
  CheckCircle,
  Pencil
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useBLEStore } from '@/lib/ble-store';
import { SettingsOverlay } from './settings-overlay';
import { generateAccessibleLabel, useScreenReader } from '@/hooks/use-keyboard-shortcuts';

interface TerminalConsoleProps {
  deviceId: string;
}

export function TerminalConsole({ deviceId }: TerminalConsoleProps) {
  const [inputValue, setInputValue] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [inputValidation, setInputValidation] = useState<{ isValid: boolean; formatted?: string; error?: string } | null>(null);
  
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLElement | null>(null);
  const [shouldStickToBottom, setShouldStickToBottom] = useState<boolean>(true);
  const inputRef = useRef<HTMLInputElement>(null);
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

  // Focus input when characteristic is selected
  useEffect(() => {
    if (selectedCharacteristicId && inputRef.current) {
      inputRef.current.focus();
    }
  }, [selectedCharacteristicId]);

  // Real-time input validation
  useEffect(() => {
    if (inputValue && deviceSettings.sendFormat === 'HEX') {
      const validation = validateHexInput(inputValue, deviceSettings.hexFillerPosition);
      setInputValidation(validation);
    } else {
      setInputValidation(null);
    }
  }, [inputValue, deviceSettings.sendFormat, deviceSettings.hexFillerPosition, validateHexInput]);

  const handleSend = () => {
    if (!selectedCharacteristicId || !selectedServiceId || !canWrite) return;
    
    if (inputValidation && !inputValidation.isValid) {
      announce('Invalid input format', 'assertive');
      return;
    }

    const message = inputValidation?.formatted || inputValue;
    if (!message.trim()) return;

    write(deviceId, selectedServiceId, selectedCharacteristicId, message);
    setInputValue('');
    announce('Message sent', 'polite');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

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
        // Render printable ASCII, non-printable as '.'
        return Array.from(bytes)
          .map(b => (b >= 0x20 && b <= 0x7E ? String.fromCharCode(b) : '.'))
          .join('');
      }
      default:
        return '';
    }
  };

  const getDirectionIcon = (direction: 'in' | 'out') => {
    return direction === 'out' ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />;
  };

  const getDirectionColor = (direction: 'in' | 'out', isPrevious?: boolean) => {
    const baseColor = direction === 'out' ? 'text-blue-600' : 'text-green-600';
    return isPrevious ? `${baseColor} opacity-50` : baseColor;
  };

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

  // Dynamically wrap text based on available width
  function WrappedText({ text, isPrevious }: { text: string; isPrevious?: boolean }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [maxChars, setMaxChars] = useState<number>(80);

    useEffect(() => {
      const compute = () => {
        const el = containerRef.current;
        if (!el) return;
        const width = el.getBoundingClientRect().width || 640; // fallback
        // Measure monospace char width by probing 10 M's
        const probe = document.createElement('span');
        probe.style.visibility = 'hidden';
        probe.style.position = 'absolute';
        probe.style.whiteSpace = 'pre';
        probe.className = 'font-mono text-sm';
        probe.textContent = 'MMMMMMMMMM';
        el.appendChild(probe);
        const probeWidth = probe.getBoundingClientRect().width || 80;
        el.removeChild(probe);
        const charWidth = Math.max(4, probeWidth / 10); // guard minimum
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

    const lines = wrapTextToLines(text, maxChars);
    return (
      <div ref={containerRef} className={`text-sm font-mono whitespace-pre-wrap break-words w-full ${isPrevious ? 'opacity-50' : ''}`}>
        {lines.map((ln, i) => (
          <div key={i}>{ln}</div>
        ))}
      </div>
    );
  }

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
    estimateSize: () => 72, // Just the content height
    overscan: 10,
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
                <Button size="sm" variant="outline" className="bg-white text-foreground" onClick={() => setEditorOpen(true)}>
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
                          <Button size="sm" variant="outline" className="px-2" onClick={() => read(deviceId, svc.uuid, ch.uuid)}>
                            <BookOpen className="h-3 w-3 mr-1" /> Read
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" aria-label="Remove" onClick={() => {
                          const keyToRemove = key;
                          const nextReadArr = (deviceUI.selectedReadKeys || []).filter((k: string) => k !== keyToRemove);
                          const nextNotifyArr = (deviceUI.selectedNotifyKeys || []).filter((k: string) => k !== keyToRemove);
                          const nextIndicateArr = (deviceUI.selectedIndicateKeys || []).filter((k: string) => k !== keyToRemove);
                          setDeviceUI(deviceId, { selectedReadKeys: nextReadArr, selectedNotifyKeys: nextNotifyArr, selectedIndicateKeys: nextIndicateArr, ...(writeKey === keyToRemove ? { writeMode: null } : {}) });
                          // Check if the characteristic will still be subscribed after removal
                          // If it was in notify/indicate arrays and is being removed, it should be unsubscribed
                          const wasNotifySelected = (deviceUI.selectedNotifyKeys || []).includes(keyToRemove);
                          const wasIndicateSelected = (deviceUI.selectedIndicateKeys || []).includes(keyToRemove);
                          const shouldUnsubscribe = (wasNotifySelected || wasIndicateSelected) && ch.subscribed;
                          if (shouldUnsubscribe) {
                            (useBLEStore.getState() as any).unsubscribe(deviceId, svc.uuid, ch.uuid);
                          }
                        }}>
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
                    <Button size="sm" variant="outline" className="bg-white text-foreground" onClick={() => setEditorOpen(true)}>
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
                                >
                                  read
                                </Badge>
                              )}
                              {caps.notify && (
                                <Badge
                                  variant={selectedNotifySet.has(key) ? 'default' : 'secondary'}
                                  className="text-[11px] px-2 py-0.5 cursor-pointer"
                                  onClick={() => {
                                    const next = new Set<string>(selectedNotifySet);
                                    const wasSelected = next.has(key);
                                    if (wasSelected) next.delete(key); else next.add(key);
                                    const willBeSubscribed = next.has(key) || selectedIndicateSet.has(key);
                                    if (willBeSubscribed && !ch.subscribed) {
                                      (useBLEStore.getState() as any).subscribe(deviceId, service.uuid, ch.uuid);
                                    }
                                    if (!willBeSubscribed && ch.subscribed) {
                                      (useBLEStore.getState() as any).unsubscribe(deviceId, service.uuid, ch.uuid);
                                    }
                                    setDeviceUI(deviceId, { selectedNotifyKeys: Array.from(next) as string[] });
                                  }}
                                >
                                  notify
                                </Badge>
                              )}
                              {caps.indicate && (
                                <Badge
                                  variant={selectedIndicateSet.has(key) ? 'default' : 'secondary'}
                                  className="text-[11px] px-2 py-0.5 cursor-pointer"
                                  onClick={() => {
                                    const next = new Set<string>(selectedIndicateSet);
                                    const wasSelected = next.has(key);
                                    if (wasSelected) next.delete(key); else next.add(key);
                                    const willBeSubscribed = selectedNotifySet.has(key) || next.has(key);
                                    if (willBeSubscribed && !ch.subscribed) {
                                      (useBLEStore.getState() as any).subscribe(deviceId, service.uuid, ch.uuid);
                                    }
                                    if (!willBeSubscribed && ch.subscribed) {
                                      (useBLEStore.getState() as any).unsubscribe(deviceId, service.uuid, ch.uuid);
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
                                  onClick={() => {
                                    if (writeSelected && writeMode === 'write') {
                                      setDeviceUI(deviceId, { writeMode: null });
                                    } else {
                                      setDeviceUI(deviceId, { selectedServiceId: service.uuid, selectedCharacteristicId: ch.uuid, writeMode: 'write' });
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
                                  onClick={() => {
                                    if (writeSelected && writeMode === 'writeNoResp') {
                                      setDeviceUI(deviceId, { writeMode: null });
                                    } else {
                                      setDeviceUI(deviceId, { selectedServiceId: service.uuid, selectedCharacteristicId: ch.uuid, writeMode: 'writeNoResp' });
                                    }
                                  }}
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
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium">Console</h3>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSettingsOpen(true)}
                aria-label="Open settings"
              >
                <Settings className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearConsole}
                aria-label="Clear console"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear
              </Button>
            </div>
          </div>

          <ScrollArea ref={scrollAreaRef} className="flex-1 min-h-0 border rounded-md p-3 bg-muted/30">
            {consoleMessages.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No messages yet</p>
                <p className="text-xs">Send a message or subscribe to notifications</p>
              </div>
            ) : (
              <div className="relative w-full" style={{ height: totalSize + Math.max(0, consoleMessages.length - 1) * ROW_GAP_PX }}>
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
                        transform: `translateY(${vItem.start + vItem.index * ROW_GAP_PX}px)`,
                      }}
                      className=""
                    >
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
                          <WrappedText text={formatData(message.rawBytes, message.renderFormatAtTime)} isPrevious={message.isPrevious} />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(formatData(message.rawBytes, message.renderFormatAtTime))}
                            aria-label={`Copy ${message.direction === 'in' ? 'received' : 'sent'} message`}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Input Area */}
        <div className="space-y-2 mt-auto">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={`Type message (${deviceSettings.sendFormat})...`}
              disabled={!canWrite}
              className={`flex-1 ${deviceSettings.sendFormat === 'HEX' && inputValidation && !inputValidation.isValid ? 'border-red-500' : ''}`}
              aria-label={`Message input (${deviceSettings.sendFormat} format)`}
              aria-describedby={inputValidation ? 'input-validation' : undefined}
            />
            
            <Button
              onClick={handleSend}
              disabled={!canWrite || (inputValidation ? !inputValidation.isValid : false)}
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>

          {/* Input Validation */}
          {inputValidation && deviceSettings.sendFormat !== 'HEX' && (
            <div id="input-validation">
              <Alert variant={inputValidation.isValid ? 'default' : 'destructive'}>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {inputValidation.isValid ? (
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>Valid HEX: {inputValidation.formatted}</span>
                    </div>
                  ) : (
                    <span>{inputValidation.error}</span>
                  )}
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Format Help */}
          {deviceSettings.sendFormat === 'HEX' && (
            <p className="text-xs text-muted-foreground">
              Enter HEX values (e.g., 48 65 6C 6C 6F for "Hello"). Invalid characters will be highlighted.
            </p>
          )}
        </div>
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
