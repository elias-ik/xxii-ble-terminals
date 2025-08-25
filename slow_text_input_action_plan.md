## Slow text input action plan

Objective: Eliminate typing lag across the app, with priority on the Terminal input at `app/components/terminal-console-simple.tsx`.

### Priority 1: Decouple the input from heavy renders
1) Extract input into a dedicated, memoized child
   - Create `TerminalSendInput` component that only renders the input + send button.
   - Props: `canWrite`, `sendFormat`, `onSend(message: string)`, and a controlled `value` + `onChange` OR keep internal state and report on send.
   - Wrap with `React.memo` and ensure props are stable via `useCallback` in parent.

2) Move validation into the input component and debounce heavy work
   - Run `validateHexInput` inside the input component.
   - Debounce normalization/validation by ~16–33ms (one frame) to avoid per-keystroke thrash.
   - Keep immediate UI echo (typed char displays synchronously), update validation state with slight delay.

3) Avoid parent rerenders on keystroke
   - Keep `inputValue` inside `TerminalSendInput` local state.
   - The parent receives the final message on send via callback. Parent state does not change on each keystroke.

### Priority 2: Reduce console render cost
4) Precompute and cache formatted text per message
   - Compute rendered string at append time (when message is created) inside the store or a helper, keyed by `message.id` and `renderFormatAtTime`.
   - Store the formatted string alongside the message; avoid running `formatData` in the render loop.

5) Isolate the virtualized list from unrelated state
   - Extract the console list into a separate component, subscribe only to `consoleMessages[deviceId]` using a selector from `useBLEStore` to limit updates.
   - Memoize `ConsoleMessageRow`; ensure props are primitive or memoized.

6) Stable identities and minimal allocations
   - Hoist constant style objects and functions out of render where possible.
   - Memoize `copyToClipboard`, `getFormatBadgeColor` with `useCallback`/`useMemo`.

### Priority 3: Store subscription and selection
7) Use store selectors
   - Replace `const state = useBLEStore();` with targeted selectors: messages, connection, deviceUI, etc.
   - This lowers re-render frequency and prop churn.

8) Memoize derived sets and keys
   - Use `useMemo` for `selectedReadSet/NotifySet/IndicateSet` based on the corresponding arrays.

### Priority 4: Progressive enhancements
9) Defer offscreen or low-priority work
   - Use `requestIdleCallback` (with fallback) to precompute expensive format conversions for older messages.

10) Optional: Web worker for heavy formatting
   - If message formatting becomes complex, move to a worker and cache results back in store.

### Acceptance criteria
- Typing into the Terminal input shows characters with no visible delay at 60 WPM while a large console (10k+ messages with virtualization) is present.
- Console scroll and selection remain smooth during typing.
- No change to user-visible behavior or feature set.

### Rollout plan
1) Implement `TerminalSendInput` and integrate into `TerminalConsole` (keep behavior identical).
2) Extract `ConsoleList` subcomponent with store selector and memoized rows.
3) Move message formatting to message creation path and store formatted text.
4) Audit other inputs (settings overlay) for similar decoupling and memoization patterns.


