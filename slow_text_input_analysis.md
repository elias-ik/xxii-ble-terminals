## Slow text input analysis

Scope: All inputs feel choppy across the app; the most important one is the message input at `app/components/terminal-console-simple.tsx` (TerminalConsole). This document outlines likely root causes and evidence from the current implementation.

### Symptom
- Typing into inputs has a perceptible delay between keystroke and character display.
- Most visible in the Terminal input (bottom of `TerminalConsole`).

### High-confidence root causes
1) Monolithic component re-renders on each keystroke
   - `TerminalConsole` holds `inputValue` in local state. Every keystroke re-renders the entire component tree: Active Characteristics block, Editor dialog, Console header, the virtualized Console list, etc.
   - Expensive subtrees: the console virtualization and message rows; they recompute derived values per render.

2) Per-render formatting of console messages
   - In `TerminalConsole`, during render we map over virtualized items and compute `formattedText = formatData(message.rawBytes, message.renderFormatAtTime)` for each visible message.
   - Result: on every keystroke (state change) we re-run formatting for a handful to dozens of rows. This is string-heavy and allocates new strings every time.

3) Virtualizer work on each render
   - `useVirtualizer` is used in the same component. Re-renders recalculate `virtualItems` and call `measureElement` on rows, potentially triggering layout work.
   - While virtualization is efficient for long lists, it should be isolated from unrelated re-renders like typing.

4) Validation runs on every keystroke
   - `useEffect` validates on every `inputValue` change when `sendFormat === 'HEX'` via `validateHexInput`.
   - If the validator does complex normalization (e.g., spacing, filler insertion), it can add overhead proportional to input length.

5) Unnecessary derived allocations per render (smaller issue)
   - Sets for selected read/notify/indicate keys are rebuilt every render from arrays.
   - Multiple inline functions/objects are created each render (e.g., `onCopy`, `getFormatBadgeColor`, inline style objects), increasing prop identity churn and GC pressure.

6) Wide store subscription (contextual)
   - `const state = useBLEStore();` subscribes to the entire store. While this primarily increases re-renders on store updates, it also means a lot of props passed down and work done on each local update. Selectors would reduce work.

### Why this disproportionately impacts the Terminal input
- The console list is the heaviest subtree: multiple rows, text formatting, and virtualization layout work are all bound to the same render cycle as the input field. Any keystroke invalidates that whole subtree.
- The formatting step is O(n) per visible row (string transforms/decoding). Multiplied by the number of visible rows and keystrokes per second, this creates a noticeable lag.

### Secondary areas likely affected
- Inputs inside `settings-overlay.tsx` and other large composite components will suffer similarly if they sit in components rendering heavy lists or complex UI.

### Evidence in current code (non-exhaustive)
- `app/components/terminal-console-simple.tsx`:
  - Local `inputValue` state triggers full component render.
  - Virtualized console mapping computes `formattedText` in the parent render.
  - `useVirtualizer` and `measureElement` live alongside the input.
  - `validateHexInput` runs every keystroke for HEX mode.

### Summary
The lag is primarily render-bound: typing causes the largest, heaviest UI tree in the page to re-render and recompute formatted strings. Isolating the input from heavy trees and memoizing/moving expensive computations off the hot path will address the core issues.


