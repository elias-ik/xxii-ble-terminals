import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Settings, AlertTriangle, CheckCircle } from "lucide-react";
import { useBLEStore, type DeviceSettings } from "@/lib/ble-store";
import { isElectron } from "@/lib/env";

interface SettingsOverlayProps {
  deviceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsOverlay({ deviceId, open, onOpenChange }: SettingsOverlayProps) {
  const { getDeviceSettings, setDeviceSettings } = useBLEStore();
  const currentSettings = getDeviceSettings(deviceId);
  
  const [settings, setSettings] = useState<DeviceSettings>(currentSettings);
  const [customStart, setCustomStart] = useState<string>(() => {
    const startKnown = ['\x02'];
    const val = currentSettings.messageStart || '';
    return val && !startKnown.includes(val) ? val : '';
  });
  const [customDelimiter, setCustomDelimiter] = useState<string>(() => {
    const delimKnown = ['\x03', '\n', '\r\n', ','];
    const val = currentSettings.messageDelimiter || '';
    return val && !delimKnown.includes(val) ? val : '';
  });
  const [rxCustomStart, setRxCustomStart] = useState<string>(() => {
    const startKnown = ['\x02'];
    const val = currentSettings.rxStart || '';
    return val && !startKnown.includes(val) ? val : '';
  });
  const [rxCustomDelimiter, setRxCustomDelimiter] = useState<string>(() => {
    const delimKnown = ['\x03', '\n', '\r\n', ','];
    const val = currentSettings.rxDelimiter || '';
    return val && !delimKnown.includes(val) ? val : '';
  });

  // Sync local overlay state when store settings change (e.g., after hydration)
  useEffect(() => {
    setSettings(currentSettings);
    // Re-derive custom fields
    setCustomStart(() => {
      const known = ['\x02'];
      const val = currentSettings.messageStart || '';
      return val && !known.includes(val) ? val : '';
    });
    setCustomDelimiter(() => {
      const known = ['\x03', '\n', '\r\n', ','];
      const val = currentSettings.messageDelimiter || '';
      return val && !known.includes(val) ? val : '';
    });
    setRxCustomStart(() => {
      const known = ['\x02'];
      const val = currentSettings.rxStart || '';
      return val && !known.includes(val) ? val : '';
    });
    setRxCustomDelimiter(() => {
      const known = ['\x03', '\n', '\r\n', ','];
      const val = currentSettings.rxDelimiter || '';
      return val && !known.includes(val) ? val : '';
    });
  }, [currentSettings]);

  const handleSettingChange = (key: keyof DeviceSettings, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    setDeviceSettings(deviceId, newSettings);
  };

  const updateFraming = (key: 'messageStart' | 'messageDelimiter', value: string) => {
    handleSettingChange(key, value);
  };

  const handleSave = () => {
    setDeviceSettings(deviceId, settings);
    onOpenChange(false);
  };

  const handleCancel = () => {
    setSettings(currentSettings);
    // Re-derive custom fields from current settings
    setCustomStart(() => {
      const known = ['\x02'];
      const val = currentSettings.messageStart || '';
      return val && !known.includes(val) ? val : '';
    });
    setCustomDelimiter(() => {
      const known = ['\x03', '\n', '\r\n', ','];
      const val = currentSettings.messageDelimiter || '';
      return val && !known.includes(val) ? val : '';
    });
    setRxCustomStart(() => {
      const known = ['\x02'];
      const val = currentSettings.rxStart || '';
      return val && !known.includes(val) ? val : '';
    });
    setRxCustomDelimiter(() => {
      const known = ['\x03', '\n', '\r\n', ','];
      const val = currentSettings.rxDelimiter || '';
      return val && !known.includes(val) ? val : '';
    });
    onOpenChange(false);
  };

  const framingDisabled = !isElectron;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Console Settings
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-1">
          {/* Formatting Category */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Formatting</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
              <div className="space-y-2">
                <Label className="text-sm">Send Format</Label>
                <Select
                  value={settings.sendFormat}
                  onValueChange={(value: 'HEX' | 'UTF8' | 'ASCII') => handleSettingChange('sendFormat', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HEX">HEX</SelectItem>
                    <SelectItem value="ASCII">ASCII</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {settings.sendFormat === 'HEX' && (
                <div className="space-y-2">
                  <Label className="text-sm">HEX Filler Position</Label>
                  <RadioGroup
                    value={settings.hexFillerPosition}
                    onValueChange={(value: 'beginning' | 'end') => handleSettingChange('hexFillerPosition', value)}
                    className="flex items-center gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="beginning" id="beginning" />
                      <Label htmlFor="beginning" className="text-sm">Beginning</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="end" id="end" />
                      <Label htmlFor="end" className="text-sm">End</Label>
                    </div>
                  </RadioGroup>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Display Format</Label>
              <Select
                value={settings.displayFormat}
                onValueChange={(value: 'HEX' | 'UTF8' | 'ASCII') => handleSettingChange('displayFormat', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HEX">HEX</SelectItem>
                  <SelectItem value="ASCII">ASCII</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Framing Category */}
          <div className="relative">
            {framingDisabled && (
              <div className="absolute inset-0 z-10 bg-background/50 backdrop-blur-sm flex items-center justify-center rounded-md">
                <span className="text-xs text-muted-foreground">not available in demo</span>
              </div>
            )}
            <div className={`space-y-3 ${framingDisabled ? 'pointer-events-none opacity-50' : ''}`}>
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Framing</Label>
                <div className="flex items-center gap-2">
                  <Label className="text-sm">Separate RX</Label>
                  <Switch
                    disabled={framingDisabled}
                    checked={!!settings.splitFraming}
                    onCheckedChange={(v) => handleSettingChange('splitFraming', v)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-sm">Message Start</Label>
                  {(() => {
                    const startKnown = ['\x02'];
                    const startSelectValue = (!settings.messageStart || settings.messageStart === '')
                      ? 'none'
                      : (startKnown.includes(settings.messageStart) ? 'stx' : 'custom');
                    return (
                <Select
                  disabled={framingDisabled}
                  value={startSelectValue}
                  onValueChange={(value: string) => {
                    if (value === 'none') updateFraming('messageStart', '');
                    else if (value === 'stx') updateFraming('messageStart', '\x02');
                    else {
                      const lit = customStart && customStart.length > 0 ? customStart : '\\x';
                      setCustomStart(lit);
                      updateFraming('messageStart', lit);
                    }
                  }}
                >
                  <SelectTrigger disabled={framingDisabled}>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="stx">STX (0x02)</SelectItem>
                    <SelectItem value="custom">Custom…</SelectItem>
                  </SelectContent>
                </Select>
                    );
                  })()}
                  {(() => {
                    const startKnown = ['\x02'];
                    const startSelectValue = (!settings.messageStart || settings.messageStart === '')
                      ? 'none'
                      : (startKnown.includes(settings.messageStart) ? 'stx' : 'custom');
                    return startSelectValue === 'custom' && (
                  <input
                    type="text"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    onBlur={() => updateFraming('messageStart', customStart)}
                    disabled={framingDisabled}
                    placeholder="e.g. \\xAA or ,"
                    className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background"
                  />
                    );
                  })()}
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Message Delimiter</Label>
                  {(() => {
                    const delimKnown = ['\x03', '\n', '\r\n', ','];
                    const delimSelectValue = (!settings.messageDelimiter || settings.messageDelimiter === '')
                      ? 'none'
                      : (delimKnown.includes(settings.messageDelimiter) ? (
                          settings.messageDelimiter === '\x03' ? 'etx' :
                          settings.messageDelimiter === '\n' ? 'lf' :
                          settings.messageDelimiter === '\r\n' ? 'crlf' :
                          settings.messageDelimiter === ',' ? 'comma' : 'custom'
                        ) : 'custom');
                    return (
                <Select
                  disabled={framingDisabled}
                  value={delimSelectValue}
                  onValueChange={(value: string) => {
                    if (value === 'none') updateFraming('messageDelimiter', '');
                    else if (value === 'etx') updateFraming('messageDelimiter', '\x03');
                    else if (value === 'lf') updateFraming('messageDelimiter', '\n');
                    else if (value === 'crlf') updateFraming('messageDelimiter', '\r\n');
                    else if (value === 'comma') updateFraming('messageDelimiter', ',');
                    else {
                      const lit = customDelimiter && customDelimiter.length > 0 ? customDelimiter : '\\x';
                      setCustomDelimiter(lit);
                      updateFraming('messageDelimiter', lit);
                    }
                  }}
                >
                  <SelectTrigger disabled={framingDisabled}>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="etx">ETX (0x03)</SelectItem>
                    <SelectItem value="lf">\n</SelectItem>
                    <SelectItem value="crlf">\r\n</SelectItem>
                    <SelectItem value="comma">,</SelectItem>
                    <SelectItem value="custom">Custom…</SelectItem>
                  </SelectContent>
                </Select>
                    );
                  })()}
                  {(() => {
                    const delimKnown = ['\x03', '\n', '\r\n', ','];
                    const delimSelectValue = (!settings.messageDelimiter || settings.messageDelimiter === '')
                      ? 'none'
                      : (delimKnown.includes(settings.messageDelimiter) ? (
                          settings.messageDelimiter === '\x03' ? 'etx' :
                          settings.messageDelimiter === '\n' ? 'lf' :
                          settings.messageDelimiter === '\r\n' ? 'crlf' :
                          settings.messageDelimiter === ',' ? 'comma' : 'custom'
                        ) : 'custom');
                    return delimSelectValue === 'custom' && (
                  <input
                    type="text"
                    value={customDelimiter}
                    onChange={(e) => setCustomDelimiter(e.target.value)}
                    onBlur={() => updateFraming('messageDelimiter', customDelimiter)}
                    disabled={framingDisabled}
                    placeholder="e.g. \\x03 or ;"
                    className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background"
                  />
                    );
                  })()}
                </div>
              </div>
              {settings.splitFraming && (
                <>
                  <Separator />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-sm">RX Start</Label>
                      {(() => {
                        const startKnown = ['\x02'];
                        const startSelectValue = (!settings.rxStart || settings.rxStart === '') ? 'none' : (startKnown.includes(settings.rxStart) ? 'stx' : 'custom');
                        return (
                          <Select disabled={framingDisabled} value={startSelectValue} onValueChange={(value: string) => {
                            if (value === 'none') handleSettingChange('rxStart', '');
                            else if (value === 'stx') handleSettingChange('rxStart', '\x02');
                            else {
                              const lit = rxCustomStart && rxCustomStart.length > 0 ? rxCustomStart : '\\x';
                              setRxCustomStart(lit);
                              handleSettingChange('rxStart', lit);
                            }
                          }}>
                            <SelectTrigger disabled={framingDisabled}>
                              <SelectValue placeholder="None" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              <SelectItem value="stx">STX (0x02)</SelectItem>
                              <SelectItem value="custom">Custom…</SelectItem>
                            </SelectContent>
                          </Select>
                        );
                      })()}
                      {(() => {
                        const startKnown = ['\x02'];
                        const startSelectValue = (!settings.rxStart || settings.rxStart === '') ? 'none' : (startKnown.includes(settings.rxStart) ? 'stx' : 'custom');
                        return startSelectValue === 'custom' && (
                          <input type="text" value={rxCustomStart} onChange={(e) => setRxCustomStart(e.target.value)} onBlur={() => handleSettingChange('rxStart', rxCustomStart)} disabled={framingDisabled} placeholder="e.g. \\xAA or ," className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background" />
                        );
                      })()}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">RX Delimiter</Label>
                      {(() => {
                        const delimKnown = ['\x03', '\n', '\r\n', ','];
                        const delimSelectValue = (!settings.rxDelimiter || settings.rxDelimiter === '') ? 'none' : (
                          settings.rxDelimiter === '\x03' ? 'etx' :
                          settings.rxDelimiter === '\n' ? 'lf' :
                          settings.rxDelimiter === '\r\n' ? 'crlf' :
                          settings.rxDelimiter === ',' ? 'comma' : 'custom'
                        );
                        return (
                          <Select disabled={framingDisabled} value={delimSelectValue} onValueChange={(value: string) => {
                            if (value === 'none') handleSettingChange('rxDelimiter', '');
                            else if (value === 'etx') handleSettingChange('rxDelimiter', '\x03');
                            else if (value === 'lf') handleSettingChange('rxDelimiter', '\n');
                            else if (value === 'crlf') handleSettingChange('rxDelimiter', '\r\n');
                            else if (value === 'comma') handleSettingChange('rxDelimiter', ',');
                            else {
                              const lit = rxCustomDelimiter && rxCustomDelimiter.length > 0 ? rxCustomDelimiter : '\\x';
                              setRxCustomDelimiter(lit);
                              handleSettingChange('rxDelimiter', lit);
                            }
                          }}>
                            <SelectTrigger disabled={framingDisabled}>
                              <SelectValue placeholder="None" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              <SelectItem value="etx">ETX (0x03)</SelectItem>
                              <SelectItem value="lf">\n</SelectItem>
                              <SelectItem value="crlf">\r\n</SelectItem>
                              <SelectItem value="comma">,</SelectItem>
                              <SelectItem value="custom">Custom…</SelectItem>
                            </SelectContent>
                          </Select>
                        );
                      })()}
                      {(() => {
                        const delimKnown = ['\x03', '\n', '\r\n', ','];
                        const delimSelectValue = (!settings.rxDelimiter || settings.rxDelimiter === '') ? 'none' : (
                          settings.rxDelimiter === '\x03' ? 'etx' :
                          settings.rxDelimiter === '\n' ? 'lf' :
                          settings.rxDelimiter === '\r\n' ? 'crlf' :
                          settings.rxDelimiter === ',' ? 'comma' : 'custom'
                        );
                        return delimSelectValue === 'custom' && (
                          <input type="text" value={rxCustomDelimiter} onChange={(e) => setRxCustomDelimiter(e.target.value)} onBlur={() => handleSettingChange('rxDelimiter', rxCustomDelimiter)} disabled={framingDisabled} placeholder="e.g. \\x03 or ;" className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background" />
                        );
                      })()}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          <Separator />

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              Save Settings
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
