import { useEffect, useRef, useCallback, useState } from 'react';
import { isElectron } from '@/lib/env';
import { useBLEStore } from '@/lib/ble-store';

export interface MousePosition {
  x: number;
  y: number;
}

export interface MouseAction {
  type: 'move' | 'click' | 'type' | 'scroll' | 'conditional' | 'while' | 'do-nothing';
  id?: string;
  target?: string;
  position?: MousePosition;
  text?: string;
  delay?: number;
  condition?: () => boolean;
  actionsIfTrue?: MouseAction[];
  actionsIfFalse?: MouseAction[];
  whileCondition?: () => boolean;
  whileActions?: MouseAction[];
}

export interface MouseSimulationConfig {
  enabled: boolean;
  actions: MouseAction[];
  loop: boolean;
  showCursor: boolean;
}

export type UserControlStatus = 'demo' | 'user';

const DEFAULT_ACTIONS: MouseAction[] = [
  // Initial pause to let the page load
  { type: 'do-nothing', delay: 1000 }, // Wait 100ms, then check again

  // Step 1: Wait for scanning to be finished using while loop
  {
    type: 'while',
    id: 'wait-for-scanning-to-finish',
    whileCondition: () => {
      const scanButton = document.querySelector('[data-testid="scan-button"]') as HTMLButtonElement;
      return !!(scanButton && scanButton.disabled);
    },
    whileActions: [
      { type: 'do-nothing', delay: 100 }, // Wait 100ms, then check again
    ]
  },
  { type: 'do-nothing', delay: 1000 }, // Wait 100ms, then check again

  // Step 2: Click rescan
  { type: 'move', id: 'move-to-rescan', target: '[data-testid="scan-button"]', delay: 1500 },
  { type: 'click', id: 'click-rescan', target: '[data-testid="scan-button"]', delay: 2000 },
  
  // Step 3: Condition - if popup appears "You will be disconnected from all BLE devices. Continue?" then click yes otherwise do nothing
  {
    type: 'conditional',
    id: 'handle-disconnect-popup',
    condition: () => {
      const popup = document.querySelector('[role="dialog"], .dialog, .modal, .popup');
      const popupText = popup?.textContent || '';
      return popupText.includes('You will be disconnected from all BLE devices. Continue?');
    },
    actionsIfTrue: [
      { 
        type: 'move', 
        id: 'move-to-confirm', 
        target: '[data-testid="confirm-rescan-button"]', 
        delay: 1000 
      },
      { 
        type: 'click', 
        id: 'click-confirm', 
        target: '[data-testid="confirm-rescan-button"]', 
        delay: 1000 
      },
    ],
    actionsIfFalse: []
  },
  
  // Step 4: Wait 2 seconds
  { type: 'do-nothing', id: 'wait-2-seconds', delay: 2000 },
  
  // Step 5: Click a device (only if devices are available)
  {
    type: 'conditional',
    id: 'check-devices-available',
    condition: () => {
      const deviceRows = document.querySelectorAll('[data-testid="device-row"]');
      return deviceRows.length > 0;
    },
    actionsIfTrue: [
      { type: 'move', id: 'move-to-device', target: '[data-testid="device-row"]', delay: 1500 },
      { type: 'click', id: 'click-device', target: '[data-testid="device-row"]', delay: 1000 },
    ],
    actionsIfFalse: [
      { type: 'do-nothing', id: 'no-devices-wait', delay: 2000 },
    ]
  },
  
  // Step 6: Click connect (only if connect button exists)
  {
    type: 'conditional',
    id: 'check-connect-button',
    condition: () => {
      const connectButton = document.querySelector('[data-testid="connect-button"]');
      return !!(connectButton && connectButton instanceof HTMLElement);
    },
    actionsIfTrue: [
      { type: 'move', id: 'move-to-connect', target: '[data-testid="connect-button"]', delay: 1500 },
      { type: 'click', id: 'click-connect', target: '[data-testid="connect-button"]', delay: 3000 },
    ],
    actionsIfFalse: [
      { type: 'do-nothing', id: 'no-connect-button-wait', delay: 2000 },
    ]
  },

  // Step 7: Wait for Edit button to appear, then click (supports both locations)
  {
    type: 'while',
    id: 'wait-for-edit-button-to-appear',
    whileCondition: () => {
      const btn = document.querySelector('[data-testid="edit-active-characteristics-button"]') as HTMLElement | null;
      const isVisible = !!(btn && btn.offsetParent !== null);
      return !isVisible; // keep waiting while not visible
    },
    whileActions: [
      { type: 'do-nothing', delay: 100 },
    ]
  },
  { type: 'move', id: 'move-to-edit-active-characteristics', target: '[data-testid="edit-active-characteristics-button"]', delay: 1200 },
  { type: 'click', id: 'click-edit-active-characteristics', target: '[data-testid="edit-active-characteristics-button"]', delay: 800 },

  // Step 8: In the dialog, click read on Manufacturer Name and Model Number
  {
    type: 'while',
    id: 'wait-for-services-dialog',
    whileCondition: () => {
      const dlg = document.querySelector('[role="dialog"]');
      return !dlg;
    },
    whileActions: [
      { type: 'do-nothing', delay: 100 },
    ]
  },
  {
    type: 'conditional',
    id: 'maybe-select-read-manufacturer',
    condition: () => {
      const el = document.querySelector('[data-testid="read-manufacturer-name"]') as HTMLElement | null;
      if (!el) return false;
      const cls = (el.getAttribute('class') || '').toString();
      const isSelected = cls.includes('bg-primary');
      return !isSelected; // needs click only if not selected
    },
    actionsIfTrue: [
      { type: 'move', id: 'move-to-read-manufacturer', target: '[data-testid="read-manufacturer-name"]', delay: 800 },
      { type: 'click', id: 'click-read-manufacturer', target: '[data-testid="read-manufacturer-name"]', delay: 400 },
    ],
    actionsIfFalse: []
  },
  {
    type: 'conditional',
    id: 'maybe-select-read-model',
    condition: () => {
      const el = document.querySelector('[data-testid="read-model-number"]') as HTMLElement | null;
      if (!el) return false;
      const cls = (el.getAttribute('class') || '').toString();
      const isSelected = cls.includes('bg-primary');
      return !isSelected; // needs click only if not selected
    },
    actionsIfTrue: [
      { type: 'move', id: 'move-to-read-model', target: '[data-testid="read-model-number"]', delay: 800 },
      { type: 'click', id: 'click-read-model', target: '[data-testid="read-model-number"]', delay: 400 },
    ],
    actionsIfFalse: []
  },

  // Step 9: Close the dialog
  { type: 'move', id: 'move-to-dialog-close', target: '[data-testid="dialog-close-button"]', delay: 600 },
  { type: 'click', id: 'click-dialog-close', target: '[data-testid="dialog-close-button"]', delay: 400 },

  // Step 10: In Active Characteristics card, click row Read for Manufacturer and Model
  { type: 'do-nothing', delay: 500 },
  { type: 'move', id: 'move-to-row-read-manufacturer', target: '[data-testid="row-read-manufacturer"]', delay: 800 },
  { type: 'click', id: 'click-row-read-manufacturer', target: '[data-testid="row-read-manufacturer"]', delay: 400 },
  { type: 'do-nothing', delay: 500 },
  { type: 'move', id: 'move-to-row-read-model', target: '[data-testid="row-read-model"]', delay: 800 },
  { type: 'click', id: 'click-row-read-model', target: '[data-testid="row-read-model"]', delay: 400 },
  
  // Step 11: Reopen editor, scroll to bottom, select notify and writeNoResp for Custom Characteristic 1
  { type: 'do-nothing', delay: 600 },
  { type: 'move', id: 'move-to-edit-active-characteristics-2', target: '[data-testid="edit-active-characteristics-button"]', delay: 1200 },
  { type: 'click', id: 'click-edit-active-characteristics-2', target: '[data-testid="edit-active-characteristics-button"]', delay: 800 },
  {
    type: 'while',
    id: 'wait-for-services-dialog-2',
    whileCondition: () => {
      const dlg = document.querySelector('[role="dialog"]');
      return !dlg;
    },
    whileActions: [
      { type: 'do-nothing', delay: 100 },
    ]
  },
  { type: 'do-nothing', id: 'pause-before-scroll-dialog', delay: 500 },
  { type: 'scroll', id: 'scroll-dialog-bottom', target: '[role="dialog"] [data-radix-scroll-area-viewport]', delay: 1500 },
  {
    type: 'conditional',
    id: 'maybe-select-notify-custom-char-1',
    condition: () => {
      const el = document.querySelector('[data-testid="notify-custom-char-1"]') as HTMLElement | null;
      if (!el) return false;
      const cls = (el.getAttribute('class') || '').toString();
      const isSelected = cls.includes('bg-primary');
      return !isSelected; // needs click only if not selected
    },
    actionsIfTrue: [
      { type: 'move', id: 'move-to-notify-custom-char-1', target: '[data-testid="notify-custom-char-1"]', delay: 800 },
      { type: 'click', id: 'click-notify-custom-char-1', target: '[data-testid="notify-custom-char-1"]', delay: 400 },
    ],
    actionsIfFalse: []
  },
  {
    type: 'conditional',
    id: 'maybe-select-write-no-resp-custom-char-1',
    condition: () => {
      const el = document.querySelector('[data-testid="write-no-resp-custom-char-1"]') as HTMLElement | null;
      if (!el) return false;
      const cls = (el.getAttribute('class') || '').toString();
      const isSelected = cls.includes('bg-primary');
      return !isSelected; // needs click only if not selected
    },
    actionsIfTrue: [
      { type: 'move', id: 'move-to-write-no-resp-custom-char-1', target: '[data-testid="write-no-resp-custom-char-1"]', delay: 800 },
      { type: 'click', id: 'click-write-no-resp-custom-char-1', target: '[data-testid="write-no-resp-custom-char-1"]', delay: 400 },
    ],
    actionsIfFalse: []
  },

  { type: 'move', id: 'move-to-dialog-close', target: '[data-testid="dialog-close-button"]', delay: 600 },
  { type: 'click', id: 'click-dialog-close', target: '[data-testid="dialog-close-button"]', delay: 400 },

  
  // Room for more actions...
  // Step 12: Use console input to send commands
  { type: 'move', id: 'move-to-terminal-input-1', target: '[data-testid="terminal-input"]', delay: 800 },
  { type: 'do-nothing', delay: 500 },
  { type: 'click', id: 'click-terminal-input-1', target: '[data-testid="terminal-input"]', delay: 400 },
  { type: 'do-nothing', delay: 500 },
  { type: 'type', id: 'type-ATZ', target: '[data-testid="terminal-input"]', text: 'ATZ', delay: 400 },
  { type: 'do-nothing', delay: 500 },
  { type: 'move', id: 'move-to-send-button', target: '[data-testid="send-button"]', delay: 600 },
  { type: 'while', id: 'wait-send-enabled-1', whileCondition: () => {
    const btn = document.querySelector('[data-testid="send-button"]') as HTMLButtonElement | null;
    return !!(btn && btn.disabled);
  }, whileActions: [ { type: 'do-nothing', delay: 100 } ] },
  { type: 'do-nothing', delay: 500 },
  { type: 'click', id: 'click-send-button', target: '[data-testid="send-button"]', delay: 400 },
  { type: 'do-nothing', delay: 500 },
  { type: 'move', id: 'move-to-terminal-input-2', target: '[data-testid="terminal-input"]', delay: 800 },
  { type: 'do-nothing', delay: 500 },
  { type: 'click', id: 'click-terminal-input-2', target: '[data-testid="terminal-input"]', delay: 400 },
  { type: 'do-nothing', delay: 500 },
  { type: 'type', id: 'type-json-cmd', target: '[data-testid="terminal-input"]', text: '{ "cmd" : [ 44, 67, 125 ] }', delay: 600 },
  { type: 'do-nothing', delay: 500 },
  { type: 'move', id: 'move-to-send-button-2', target: '[data-testid="send-button"]', delay: 600 },
  { type: 'while', id: 'wait-send-enabled-2', whileCondition: () => {
    const btn = document.querySelector('[data-testid="send-button"]') as HTMLButtonElement | null;
    return !!(btn && btn.disabled);
  }, whileActions: [ { type: 'do-nothing', delay: 100 } ] },
  { type: 'do-nothing', delay: 500 },
  { type: 'click', id: 'click-send-button-2', target: '[data-testid="send-button"]', delay: 400 },

  { type: 'do-nothing', delay: 100000 }, // Wait 100ms, then check again

];

export function useMouseSimulation() {
  const [config, setConfig] = useState<MouseSimulationConfig>({
    enabled: false, // Will be set to true in demo mode via useEffect
    actions: DEFAULT_ACTIONS,
    loop: true,
    showCursor: true,
  });
  
  const [currentPosition, setCurrentPosition] = useState<MousePosition>({ x: 0, y: 0 });
  const [isActive, setIsActive] = useState(false);
  const [currentActionIndex, setCurrentActionIndex] = useState(0);
  const [userControlStatus, setUserControlStatus] = useState<UserControlStatus>('demo');
  
  const cursorRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const timeoutsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const hasStartedRef = useRef<boolean>(false);
  const isActiveRef = useRef<boolean>(false);
  const currentActionIndexRef = useRef<number>(0);
  const stopRef = useRef<() => void>(() => {});
  const currentPositionRef = useRef<MousePosition>({ x: 0, y: 0 });
  const userControlStatusRef = useRef<UserControlStatus>('demo');
  const isUserControlRef = useRef<boolean>(false);

  // We don't actually need these functions for the simulation, but keeping for future use
  // const { scan, connect, disconnect, write, subscribe, clearConsole } = useBLEStore();

  // Note: speed has been removed; action delays are used as-is

  // Find element by test ID or selector
  const findElement = useCallback((target: string): HTMLElement | null => {
    // Prefer visible, enabled matches when multiple exist
    const nodeList = document.querySelectorAll(target) as NodeListOf<HTMLElement>;
    if (nodeList && nodeList.length > 0) {
      for (const el of Array.from(nodeList)) {
        const isVisible = !!el.offsetParent;
        const isDisabled = (el as HTMLButtonElement).disabled === true;
        if (isVisible && !isDisabled) return el;
      }
      // No suitable enabled visible element found
      return null;
    }
    return null;
  }, []);

  // Get element position
  const getElementPosition = useCallback((element: HTMLElement): MousePosition => {
    const rect = element.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  }, []);

  // Animate mouse movement
  const animateMouseMove = useCallback((from: MousePosition, to: MousePosition, duration: number): Promise<void> => {
    return new Promise((resolve) => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      const startTime = performance.now();
      const startX = from.x;
      const startY = from.y;
      const deltaX = to.x - from.x;
      const deltaY = to.y - from.y;
      
      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function (ease-out)
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        
        const x = startX + deltaX * easeProgress;
        const y = startY + deltaY * easeProgress;
        
        const newPosition = { x, y };
        setCurrentPosition(newPosition);
        currentPositionRef.current = newPosition;
        
        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate);
        } else {
          animationRef.current = undefined;
          resolve();
        }
      };
      
      animationRef.current = requestAnimationFrame(animate);
    });
  }, []);

  // Animate element scrollTop to target value
  const animateElementScroll = useCallback((element: HTMLElement, targetScrollTop: number, duration: number): Promise<void> => {
    return new Promise((resolve) => {
      if (duration <= 0) {
        element.scrollTop = targetScrollTop;
        resolve();
        return;
      }
      const startTime = performance.now();
      const startTop = element.scrollTop;
      const delta = targetScrollTop - startTop;

      const step = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3);
        element.scrollTop = startTop + delta * ease;
        if (progress < 1) {
          animationRef.current = requestAnimationFrame(step);
        } else {
          animationRef.current = undefined;
          resolve();
        }
      };

      animationRef.current = requestAnimationFrame(step);
    });
  }, []);

  // Set input value in a way React reliably detects (uses native setter)
  const setReactInputValue = useCallback((input: HTMLInputElement, value: string) => {
    const proto = Object.getPrototypeOf(input);
    const valueSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (valueSetter) {
      valueSetter.call(input, value);
    } else {
      // Fallback
      (input as any).value = value;
    }
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, []);

  // Helper: cancellable sleep that is cleared on stop
  const safeSleep = useCallback(async (ms: number) => {
    if (ms <= 0) ms = 1; // ensure a macrotask yield
    await new Promise<void>((resolve) => {
      const t = setTimeout(() => {
        timeoutsRef.current.delete(t);
        resolve();
      }, ms);
      timeoutsRef.current.add(t);
    });
  }, []);

  // Execute a mouse action
  const executeAction = useCallback(async (action: MouseAction) => {
    const actualDelay = action.delay ?? 1000;
    
    // Helper to compute distance for avoiding redundant small moves
    const distance = (a: MousePosition, b: MousePosition) => Math.hypot(a.x - b.x, a.y - b.y);
    
    // If we've been stopped or user took control, abort
    if (!isActiveRef.current || isUserControlRef.current) {
      return;
    }

    const actionStart = performance.now();
    if (action.id) {
      console.log(`▶️ Demo: Starting action [${action.type}]`, {
        id: action.id,
        target: action.target,
        timestamp: new Date().toISOString()
      });
    }
    
    switch (action.type) {
      case 'do-nothing':
        // Just wait for the specified delay
        await safeSleep(actualDelay);
        break;
        
      case 'conditional':
        if (action.condition) {
          const conditionResult = action.condition();
          
          const actionsToExecute = conditionResult ? action.actionsIfTrue : action.actionsIfFalse;
          if (actionsToExecute && actionsToExecute.length > 0) {
            // Execute all actions in the conditional branch
            for (let i = 0; i < actionsToExecute.length; i++) {
              const conditionalAction = actionsToExecute[i];
              
              // Execute the conditional action directly (it handles its own delays)
              await executeAction(conditionalAction);
            }
          }
        } else {
          console.warn(`⚠️ Demo: Conditional action has no condition function`);
        }
        break;
        
      case 'while':
        if (action.whileCondition && action.whileActions) {
          while (isActiveRef.current && !isUserControlRef.current && action.whileCondition()) {
            // Execute all actions in the while loop
            for (let i = 0; i < action.whileActions.length; i++) {
              const whileAction = action.whileActions[i];
              // Execute the while action directly (it handles its own delays)
              await executeAction(whileAction);
            }
            // Re-evaluate guards and condition; loop will exit naturally if any becomes false
          }
        } else {
          console.warn(`⚠️ Demo: While action has no condition or actions`);
        }
        break;
        
      case 'move':
        if (action.target) {
          const element = findElement(action.target);
          if (element) {
            const targetPos = getElementPosition(element);
            const fromPos = currentPositionRef.current;
            if (distance(fromPos, targetPos) > 2) {
              await animateMouseMove(fromPos, targetPos, actualDelay);
            }
          } else {
            console.warn(`⚠️ Demo: Element not found for target "${action.target}"`);
          }
        } else if (action.position) {
          const fromPos = currentPositionRef.current;
          if (distance(fromPos, action.position) > 2) {
            await animateMouseMove(fromPos, action.position, actualDelay);
          }
        }
        break;
        
      case 'click':
        if (action.target) {
          const element = findElement(action.target);
          if (element) {
            const targetPos = getElementPosition(element);
            
            // Move to position first (if needed), then click
            const fromPos = currentPositionRef.current;
            if (distance(fromPos, targetPos) > 2) {
              await animateMouseMove(fromPos, targetPos, actualDelay);
            }
            
            // Click immediately after movement completes
            element.click();
          } else {
            console.warn(`⚠️ Demo: Element not found for click target "${action.target}"`);
          }
        }
        break;
        
      case 'type':
        if (action.target && action.text) {
          const element = findElement(action.target) as HTMLInputElement;
          if (element) {
            const targetPos = getElementPosition(element);
            
            // Move to position first (if needed), then type
            const fromPos = currentPositionRef.current;
            if (distance(fromPos, targetPos) > 2) {
              await animateMouseMove(fromPos, targetPos, actualDelay);
            }
            
            element.focus();
            setReactInputValue(element, action.text!);
          } else {
            console.warn(`⚠️ Demo: Element not found for type target "${action.target}"`);
          }
        }
        break;
        
      case 'scroll':
        if (action.target) {
          const element = document.querySelector(action.target) as HTMLElement | null;
          if (element) {
            const maxScroll = Math.max(0, element.scrollHeight - element.clientHeight);
            const current = element.scrollTop || 0;
            if (Math.abs(maxScroll - current) > 2) {
              await animateElementScroll(element, maxScroll, actualDelay);
            }
          } else {
            console.warn(`⚠️ Demo: Element not found for scroll target "${action.target}"`);
          }
        }
        break;
    }
    
    // ID logging after action completes (synchronized with visuals)
    if (action.id) {
      const durationMs = Math.round(performance.now() - actionStart);
      console.log(`✅ Demo: Finished action [${action.type}]`, {
        id: action.id,
        target: action.target,
        durationMs,
        timestamp: new Date().toISOString()
      });
    }
  }, [findElement, getElementPosition, animateMouseMove]);
  
  // Run next action - using refs to avoid closure issues
  const runNextAction = useCallback(async () => {
    // Sequential scheduler loop; no recursive timers
    console.log('🧭 Demo: Scheduler starting', {
      totalActions: config.actions.length,
      timestamp: new Date().toISOString()
    });
    while (isActiveRef.current && !isUserControlRef.current) {
      if (currentActionIndexRef.current >= config.actions.length) {
        if (config.loop) {
          currentActionIndexRef.current = 0;
          setCurrentActionIndex(0);
        } else {
          stopRef.current();
          return;
        }
      }

      const action = config.actions[currentActionIndexRef.current];
      console.log('➡️ Demo: Executing index', {
        index: currentActionIndexRef.current,
        type: action.type,
        id: action.id,
        timestamp: new Date().toISOString()
      });
      await executeAction(action);

      if (!isActiveRef.current || isUserControlRef.current) {
        console.log('🛑 Demo: Scheduler stopping mid-loop', {
          isActive: isActiveRef.current,
          userControl: isUserControlRef.current,
          timestamp: new Date().toISOString()
        });
        break;
      }

      currentActionIndexRef.current += 1;
      setCurrentActionIndex(currentActionIndexRef.current);

      // Yield to event loop to keep UI responsive
      await safeSleep(0);
    }
    console.log('✅ Demo: Scheduler finished', {
      finalIndex: currentActionIndexRef.current,
      loop: config.loop,
      isActive: isActiveRef.current,
      userControl: isUserControlRef.current,
      timestamp: new Date().toISOString()
    });
  }, [userControlStatus, config.actions, config.loop, executeAction, safeSleep]);

  // Start the simulation
  const startSimulation = useCallback(async () => {
    if (!config.enabled || isActiveRef.current || userControlStatus === 'user') {
      return;
    }
    
    console.log(`🚀 Demo: Starting simulation`, {
      totalActions: config.actions.length,
      loop: config.loop,
      timestamp: new Date().toISOString()
    });
    
    hasStartedRef.current = true;
    isActiveRef.current = true;
    currentActionIndexRef.current = 0;
    setIsActive(true);
    setCurrentActionIndex(0);
    
    // Start the scheduler (fire-and-forget)
    void runNextAction();
  }, [config.enabled, userControlStatus, config.actions.length, config.loop, runNextAction]);
  
  // Stop the simulation
  const stopSimulation = useCallback(() => {
    console.log(`⏹️ Demo: Stopping simulation`, {
      wasActive: isActiveRef.current,
      timestamp: new Date().toISOString()
    });
    
    hasStartedRef.current = false;
    isActiveRef.current = false;
    setIsActive(false);
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    // Clear all pending timeouts
    timeoutsRef.current.forEach((t) => clearTimeout(t));
    timeoutsRef.current.clear();
  }, []);

  // Keep stopRef in sync to avoid TDZ issues when referenced above
  useEffect(() => {
    stopRef.current = stopSimulation;
  }, [stopSimulation]);

  // Keep currentPositionRef in sync with currentPosition state
  useEffect(() => {
    currentPositionRef.current = currentPosition;
  }, [currentPosition]);
  
  // Keep userControlStatusRef in sync with state
  useEffect(() => {
    userControlStatusRef.current = userControlStatus;
    isUserControlRef.current = userControlStatus === 'user';
  }, [userControlStatus]);
  
  // Handle postMessage events from parent window
  const handlePostMessage = useCallback((event: MessageEvent) => {
    // Only handle messages in demo mode (not Electron)
    if (isElectron) return;
    
    // Verify the message structure
    if (event.data && typeof event.data === 'object' && event.data.type === 'user-control-status') {
      const { control } = event.data.data;
      
      if (control === 'user') {
        // User is taking over - stop demo
        setUserControlStatus('user');
        stopSimulation();
      } else if (control === 'demo') {
        // User handing control back to demo
        setUserControlStatus('demo');
        // Auto-start simulation when control is handed back
        if (config.enabled) {
          startSimulation().catch(console.error);
        }
      }
    }
  }, [isElectron, stopSimulation, config.enabled, startSimulation]);
  
  // Set up postMessage listener
  useEffect(() => {
    if (!isElectron) {
      window.addEventListener('message', handlePostMessage);
      
      return () => {
        window.removeEventListener('message', handlePostMessage);
      };
    }
  }, [handlePostMessage]);
  
  // Auto-start simulation when in demo mode and control is with demo
  useEffect(() => {
    if (!isElectron && config.enabled && userControlStatus === 'demo' && !isActive && !hasStartedRef.current) {
      startSimulation().catch(console.error);
    }
  }, [isElectron, config.enabled, userControlStatus, isActive, startSimulation]);
  
  // Update config
  const updateConfig = useCallback((newConfig: Partial<MouseSimulationConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
  }, []);
  
  // Enable demo by default when in demo mode
  useEffect(() => {
    if (!isElectron && !config.enabled) {
      updateConfig({ enabled: true });
    }
  }, [isElectron, config.enabled, updateConfig]);
  
  // Toggle simulation (manual control)
  const toggleSimulation = useCallback(() => {
    if (userControlStatus === 'user') {
      return;
    }
    
    if (isActive) {
      stopSimulation();
    } else {
      startSimulation();
    }
  }, [isActive, startSimulation, stopSimulation, userControlStatus]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSimulation();
    };
  }, [stopSimulation]);
  
  // Only enable in demo mode (not Electron)
  const isDemoMode = !isElectron;
  
  return {
    // State
    config,
    currentPosition,
    isActive,
    currentActionIndex,
    isDemoMode,
    userControlStatus,
    
    // Actions
    startSimulation,
    stopSimulation,
    toggleSimulation,
    updateConfig,
    
    // Refs
    cursorRef,
  };
}
