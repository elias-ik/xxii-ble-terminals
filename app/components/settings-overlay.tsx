import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Settings, AlertTriangle, CheckCircle } from "lucide-react";
import { useBLEStore, type DeviceSettings } from "@/lib/ble-store";

interface SettingsOverlayProps {
  deviceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsOverlay({ deviceId, open, onOpenChange }: SettingsOverlayProps) {
  const { getDeviceSettings, setDeviceSettings } = useBLEStore();
  const currentSettings = getDeviceSettings(deviceId);
  
  const [settings, setSettings] = useState<DeviceSettings>(currentSettings);
  const [customStart, setCustomStart] = useState<string>("");
  const [customDelimiter, setCustomDelimiter] = useState<string>("");

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
    setCustomStart("");
    setCustomDelimiter("");
    onOpenChange(false);
  };

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
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Framing</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm">Message Start</Label>
                <Select
                  value={settings.messageStart || ''}
                  onValueChange={(value: string) => updateFraming('messageStart', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    <SelectItem value="\x02">STX (0x02)</SelectItem>
                    <SelectItem value="custom">Custom…</SelectItem>
                  </SelectContent>
                </Select>
                {settings.messageStart === 'custom' && (
                  <input
                    type="text"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    onBlur={() => updateFraming('messageStart', customStart)}
                    placeholder="e.g. \\xAA or ,"
                    className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background"
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Message Delimiter</Label>
                <Select
                  value={settings.messageDelimiter || ''}
                  onValueChange={(value: string) => updateFraming('messageDelimiter', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    <SelectItem value="\x03">ETX (0x03)</SelectItem>
                    <SelectItem value="\n">\n</SelectItem>
                    <SelectItem value="\r\n">\r\n</SelectItem>
                    <SelectItem value=",">,</SelectItem>
                    <SelectItem value="custom">Custom…</SelectItem>
                  </SelectContent>
                </Select>
                {settings.messageDelimiter === 'custom' && (
                  <input
                    type="text"
                    value={customDelimiter}
                    onChange={(e) => setCustomDelimiter(e.target.value)}
                    onBlur={() => updateFraming('messageDelimiter', customDelimiter)}
                    placeholder="e.g. \\x03 or ;"
                    className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background"
                  />
                )}
              </div>
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
