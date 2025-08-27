import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, CheckCircle, Send } from 'lucide-react';

type SendFormat = 'HEX' | 'UTF8' | 'ASCII';

export interface TerminalSendInputProps {
  canWrite: boolean;
  sendFormat: SendFormat;
  hexFillerPosition: 'none' | 'before' | 'after' | string;
  validateHexInput: (value: string, hexFillerPosition: TerminalSendInputProps['hexFillerPosition']) => { isValid: boolean; formatted?: string; error?: string };
  onSend: (message: string) => void;
  focusWhenKey?: string | null;
}

export const TerminalSendInput: React.FC<TerminalSendInputProps> = React.memo(function TerminalSendInput({
  canWrite,
  sendFormat,
  hexFillerPosition,
  validateHexInput,
  onSend,
  focusWhenKey,
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState('');
  const [debouncedValidation, setDebouncedValidation] = useState<{ isValid: boolean; formatted?: string; error?: string } | null>(null);

  // Focus when focus key changes and there is an input
  useEffect(() => {
    if (focusWhenKey && inputRef.current) {
      inputRef.current.focus();
    }
  }, [focusWhenKey]);

  // Debounced validation to avoid per-keystroke heavy work
  useEffect(() => {
    if (sendFormat !== 'HEX') {
      setDebouncedValidation(null);
      return;
    }
    if (!inputValue) {
      setDebouncedValidation(null);
      return;
    }
    const handle = setTimeout(() => {
      try {
        const result = validateHexInput(inputValue, hexFillerPosition);
        setDebouncedValidation(result);
      } catch {
        setDebouncedValidation({ isValid: false, error: 'Validation error' });
      }
    }, 32);
    return () => clearTimeout(handle);
  }, [inputValue, sendFormat, hexFillerPosition, validateHexInput]);

  const computeValidationImmediate = useCallback(() => {
    if (sendFormat !== 'HEX') return null;
    if (!inputValue) return null;
    try {
      return validateHexInput(inputValue, hexFillerPosition);
    } catch {
      return { isValid: false, error: 'Validation error' };
    }
  }, [hexFillerPosition, inputValue, sendFormat, validateHexInput]);

  const handleSend = useCallback(() => {
    if (!canWrite) return;
    const validation = computeValidationImmediate();
    if (sendFormat === 'HEX') {
      if (validation && !validation.isValid) return;
    }
    const message = (validation?.formatted ?? inputValue).trim();
    if (!message) return;
    onSend(message);
    setInputValue('');
  }, [canWrite, computeValidationImmediate, inputValue, onSend, sendFormat]);

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const isSendDisabled = useMemo(() => {
    if (!canWrite) return true;
    if (sendFormat === 'HEX' && debouncedValidation) return !debouncedValidation.isValid;
    return false;
  }, [canWrite, debouncedValidation, sendFormat]);

  return (
    <div className="space-y-2 mt-auto">
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={`Type message (${sendFormat})...`}
          disabled={!canWrite}
          className={`flex-1 ${sendFormat === 'HEX' && debouncedValidation && !debouncedValidation.isValid ? 'border-red-500' : ''}`}
          aria-label={`Message input (${sendFormat} format)`}
          aria-describedby={debouncedValidation ? 'input-validation' : undefined}
          data-testid="terminal-input"
        />

        <Button
          onClick={handleSend}
          disabled={isSendDisabled}
          aria-label="Send message"
          data-testid="send-button"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>

      {/* Input Validation */}
      {debouncedValidation && sendFormat !== 'HEX' && (
        <div id="input-validation">
          <Alert variant={debouncedValidation.isValid ? 'default' : 'destructive'}>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {debouncedValidation.isValid ? (
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>Valid HEX: {debouncedValidation.formatted}</span>
                </div>
              ) : (
                <span>{debouncedValidation.error}</span>
              )}
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Format Help */}
      {sendFormat === 'HEX' && (
        <p className="text-xs text-muted-foreground">
          Enter HEX values (e.g., 48 65 6C 6C 6F for "Hello"). Invalid characters will be highlighted.
        </p>
      )}
    </div>
  );
});


