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
  speed: 'slow' | 'normal' | 'fast';
  actions: MouseAction[];
  loop: boolean;
  showCursor: boolean;
}

export type UserControlStatus = 'demo' | 'user';

const DEFAULT_ACTIONS: MouseAction[] = [
  // Initial pause to let the page load
  { type: 'move', id: 'initial-pause', position: { x: 100, y: 100 }, delay: 2000 },
  
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
  
  // Room for more actions...
  { type: 'do-nothing', id: 'final-pause', delay: 2000 },
];

export function useMouseSimulation() {
  const [config, setConfig] = useState<MouseSimulationConfig>({
    enabled: false, // Will be set to true in demo mode via useEffect
    speed: 'normal',
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

  // Speed multipliers
  const speedMultipliers = {
    slow: 2.0,
    normal: 1.0,
    fast: 0.5,
  };

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
      // Fallback to first match
      return nodeList[0] as HTMLElement;
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

  // Helper: cancellable sleep that is cleared on stop
  const safeSleep = useCallback(async (ms: number) => {
    if (ms <= 0) return;
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
    const baseDelay = action.delay || 1000;
    const actualDelay = baseDelay * speedMultipliers[config.speed];
    
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
          let iterationCount = 0;
          const maxIterations = 100; // Prevent infinite loops
          
          while (isActiveRef.current && !isUserControlRef.current && action.whileCondition() && iterationCount < maxIterations) {
            iterationCount++;
            
            // Execute all actions in the while loop
            for (let i = 0; i < action.whileActions.length; i++) {
              const whileAction = action.whileActions[i];
              
              // Execute the while action directly (it handles its own delays)
              await executeAction(whileAction);
            }
            
            // Check condition again after executing all actions
            if (!isActiveRef.current || isUserControlRef.current || !action.whileCondition()) {
              break;
            }
          }
          
          if (iterationCount >= maxIterations) {
            console.warn(`⚠️ Demo: While loop reached maximum iterations (${maxIterations}), stopping`);
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
            element.value = action.text!;
            element.dispatchEvent(new Event('input', { bubbles: true }));
          } else {
            console.warn(`⚠️ Demo: Element not found for type target "${action.target}"`);
          }
        }
        break;
        
      case 'scroll':
        // Implement scroll simulation if needed
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
  }, [config.speed, findElement, getElementPosition, animateMouseMove, userControlStatus]);
  
  // Run next action - using refs to avoid closure issues
  const runNextAction = useCallback(async () => {
    // Sequential scheduler loop; no recursive timers
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
      await executeAction(action);

      if (!isActiveRef.current || isUserControlRef.current) {
        break;
      }

      currentActionIndexRef.current += 1;
      setCurrentActionIndex(currentActionIndexRef.current);

      // Yield to event loop to keep UI responsive
      await safeSleep(0);
    }
  }, [userControlStatus, config.actions, config.loop, executeAction, safeSleep]);

  // Start the simulation
  const startSimulation = useCallback(async () => {
    if (!config.enabled || isActiveRef.current || userControlStatus === 'user') {
      return;
    }
    
    console.log(`🚀 Demo: Starting simulation`, {
      totalActions: config.actions.length,
      speed: config.speed,
      loop: config.loop,
      timestamp: new Date().toISOString()
    });
    
    hasStartedRef.current = true;
    isActiveRef.current = true;
    currentActionIndexRef.current = 0;
    setIsActive(true);
    setCurrentActionIndex(0);
    
    // Start the first action
    await runNextAction();
  }, [config.enabled, userControlStatus, config.actions.length, config.speed, config.loop, runNextAction]);
  
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
