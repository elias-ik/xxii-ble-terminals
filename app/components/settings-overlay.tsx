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
  const [hexTestInput, setHexTestInput] = useState("");
  const [hexValidation, setHexValidation] = useState<{
    isValid: boolean;
    error?: string;
    formatted?: string;
  } | null>(null);

  const handleSettingChange = (key: keyof DeviceSettings, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    setDeviceSettings(deviceId, newSettings);
  };

  const handleHexTestInput = (input: string) => {
    setHexTestInput(input);
    
    if (!input.trim()) {
      setHexValidation(null);
      return;
    }

    const { validateHexInput } = useBLEStore.getState();
    const validation = validateHexInput(input);
    setHexValidation(validation);
  };

  const handleSave = () => {
    setDeviceSettings(deviceId, settings);
    onOpenChange(false);
  };

  const handleCancel = () => {
    setSettings(currentSettings);
    setHexTestInput("");
    setHexValidation(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            I/O Format Settings
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Send Format Settings */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Send Format</Label>
            <Select
              value={settings.sendFormat}
              onValueChange={(value: 'HEX' | 'UTF8' | 'ASCII') => 
                handleSettingChange('sendFormat', value)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="HEX">HEX</SelectItem>
                <SelectItem value="ASCII">ASCII</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Format for data sent to the device
            </p>
          </div>

          <Separator />

          {/* Display Format Settings */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Display Format</Label>
            <Select
              value={settings.displayFormat}
              onValueChange={(value: 'HEX' | 'UTF8' | 'ASCII') => 
                handleSettingChange('displayFormat', value)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="HEX">HEX</SelectItem>
                <SelectItem value="ASCII">ASCII</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Format for displaying console responses
            </p>
          </div>

          <Separator />

          {/* HEX Filler Position Settings */}
          {settings.sendFormat === 'HEX' && (
            <>
              <div className="space-y-3">
                <Label className="text-sm font-medium">HEX Filler Position</Label>
                <RadioGroup
                  value={settings.hexFillerPosition}
                  onValueChange={(value: 'beginning' | 'end') => 
                    handleSettingChange('hexFillerPosition', value)
                  }
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
                <p className="text-xs text-muted-foreground">
                  Where to insert filler byte for odd-length HEX input
                </p>
              </div>

              <Separator />

              {/* HEX Input Test */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">HEX Input Test</Label>
                <input
                  type="text"
                  placeholder="Enter HEX input to test..."
                  value={hexTestInput}
                  onChange={(e) => handleHexTestInput(e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background"
                />
                
                {hexValidation && (
                  <Alert className={hexValidation.isValid ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20" : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20"}>
                    <div className="flex items-center gap-2">
                      {hexValidation.isValid ? (
                        <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                      )}
                      <AlertDescription className="text-sm">
                        {hexValidation.isValid ? (
                          <span className="text-green-800 dark:text-green-200">
                            Valid HEX input. Formatted: <code className="bg-green-100 dark:bg-green-900/30 px-1 rounded">{hexValidation.formatted}</code>
                          </span>
                        ) : (
                          <span className="text-red-800 dark:text-red-200">
                            {hexValidation.error}
                          </span>
                        )}
                      </AlertDescription>
                    </div>
                  </Alert>
                )}
                
                <p className="text-xs text-muted-foreground">
                  Test HEX input validation and formatting
                </p>
              </div>
            </>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4">
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
