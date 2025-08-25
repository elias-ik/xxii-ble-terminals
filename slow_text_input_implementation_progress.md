## Slow text input implementation progress

### Step 1: Extract and integrate TerminalSendInput
- Added `app/components/terminal-send-input.tsx` as a memoized component handling the send input UI, debounced HEX validation, and submit.
- Integrated into `app/components/terminal-console-simple.tsx`, removing previous local input state, validation effect, and keypress handler to avoid parent re-renders on keystrokes.
- The input now focuses when the selected characteristic changes via the `focusWhenKey` prop.

Next steps:
- Extract the virtualized console list into a separate component with store selectors.
- Precompute and cache formatted text per message on append.

