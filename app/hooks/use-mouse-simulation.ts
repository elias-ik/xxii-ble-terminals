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
      const scanButton = document.querySelector('[data-testid="scan-button"]');
      return !!(scanButton && scanButton instanceof HTMLElement && 
             (scanButton.textContent?.includes('Stop') || scanButton.textContent?.includes('Scanning')));
    },
    whileActions: [
      { type: 'do-nothing', delay: 1000 }, // Wait 1 second, then check again
    ]
  },
  
  // Step 2: Wait until the rescan button is clickable again using while loop
  {
    type: 'while',
    id: 'wait-for-rescan-button',
    whileCondition: () => {
      const scanButton = document.querySelector('[data-testid="scan-button"]') as HTMLButtonElement;
      return !(scanButton && scanButton instanceof HTMLButtonElement && 
             scanButton.textContent?.includes('Rescan') && 
             !scanButton.disabled);
    },
    whileActions: [
      { type: 'do-nothing', delay: 100 },
    ]
  },
  
  // Step 3: Click rescan
  { type: 'move', id: 'move-to-rescan', target: '[data-testid="scan-button"]', delay: 1500 },
  { type: 'click', id: 'click-rescan', target: '[data-testid="scan-button"]', delay: 2000 },
  
  // Step 4: Condition - if popup appears "You will be disconnected from all BLE devices. Continue?" then click yes otherwise do nothing
  {
    type: 'conditional',
    id: 'handle-disconnect-popup',
    condition: () => {
      const popup = document.querySelector('[role="dialog"], .dialog, .modal, .popup');
      const popupText = popup?.textContent || '';
      return popupText.includes('You will be disconnected from all BLE devices. Continue?');
    },
    actionsIfTrue: [
      { type: 'move', id: 'move-to-confirm', target: 'button:contains("Yes"), button:contains("Continue"), [data-testid="confirm-button"]', delay: 1000 },
      { type: 'click', id: 'click-confirm', target: 'button:contains("Yes"), button:contains("Continue"), [data-testid="confirm-button"]', delay: 1000 },
    ],
    actionsIfFalse: [
      { type: 'move', id: 'no-popup-wait', position: { x: 250, y: 250 }, delay: 500 },
    ]
  },
  
  // Step 5: Wait 2 seconds
  { type: 'do-nothing', id: 'wait-2-seconds', delay: 2000 },
  
  // Step 6: Click a device
  { type: 'move', id: 'move-to-device', target: '[data-testid="device-row"]', delay: 1500 },
  { type: 'click', id: 'click-device', target: '[data-testid="device-row"]', delay: 1000 },
  
  // Step 7: Click connect
  { type: 'move', id: 'move-to-connect', target: '[data-testid="connect-button"]', delay: 1500 },
  { type: 'click', id: 'click-connect', target: '[data-testid="connect-button"]', delay: 3000 },
  
  // Room for more actions...
  { type: 'move', id: 'final-pause', position: { x: 400, y: 400 }, delay: 2000 },
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
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const hasStartedRef = useRef<boolean>(false);
  const isActiveRef = useRef<boolean>(false);
  const currentActionIndexRef = useRef<number>(0);
  const stopRef = useRef<() => void>(() => {});
  const currentPositionRef = useRef<MousePosition>({ x: 0, y: 0 });

  // We don't actually need these functions for the simulation, but keeping for future use
  // const { scan, connect, disconnect, write, subscribe, clearConsole } = useBLEStore();

  // Helper functions to check current state
  const isConnected = useCallback(() => {
    const disconnectButton = document.querySelector('[data-testid="disconnect-button"]');
    return !!(disconnectButton && disconnectButton instanceof HTMLElement && disconnectButton.offsetParent !== null);
  }, []);

  const isScanning = useCallback(() => {
    const scanButton = document.querySelector('[data-testid="scan-button"]');
    return !!(scanButton && scanButton instanceof HTMLElement && 
           (scanButton.textContent?.includes('Stop') || scanButton.textContent?.includes('Scanning')));
  }, []);

  const hasDevices = useCallback(() => {
    const deviceRows = document.querySelectorAll('[data-testid="device-row"]');
    return deviceRows.length > 0;
  }, []);

  // Speed multipliers
  const speedMultipliers = {
    slow: 2.0,
    normal: 1.0,
    fast: 0.5,
  };

  // Find element by test ID or selector
  const findElement = useCallback((target: string): HTMLElement | null => {
    if (target.startsWith('[data-testid=')) {
      return document.querySelector(target) as HTMLElement;
    }
    return document.querySelector(target) as HTMLElement;
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
  const animateMouseMove = useCallback((from: MousePosition, to: MousePosition, duration: number) => {
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
      }
    };
    
    animationRef.current = requestAnimationFrame(animate);
  }, []);

  // Execute a mouse action
  const executeAction = useCallback(async (action: MouseAction) => {
    const baseDelay = action.delay || 1000;
    const actualDelay = baseDelay * speedMultipliers[config.speed];
    
    console.log(`🎯 Demo: Executing action [${action.type}]`, {
      id: action.id,
      target: action.target,
      position: action.position,
      text: action.text,
      delay: `${baseDelay}ms → ${actualDelay}ms (${config.speed} speed)`,
      timestamp: new Date().toISOString()
    });
    
    switch (action.type) {
      case 'while':
        if (action.whileCondition && action.whileActions) {
          let iterationCount = 0;
          const maxIterations = 100; // Prevent infinite loops
          
          while (action.whileCondition() && iterationCount < maxIterations) {
            iterationCount++;
            console.log(`🔄 Demo: While loop iteration ${iterationCount}`);
            
            // Execute all actions in the while loop
            for (let i = 0; i < action.whileActions.length; i++) {
              const whileAction = action.whileActions[i];
              const whileDelay = (whileAction.delay || 1000) * speedMultipliers[config.speed];
              
              // Execute the while action
              await new Promise<void>((resolve) => {
                setTimeout(async () => {
                  await executeAction(whileAction);
                  resolve();
                }, whileDelay);
              });
            }
            
            // Check condition again after executing all actions
            if (!action.whileCondition()) {
              console.log(`✅ Demo: While loop condition became false after ${iterationCount} iterations`);
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
        
      case 'do-nothing':
        console.log(`⏸️ Demo: Doing nothing for ${actualDelay}ms`);
        // Just wait for the specified delay
        await new Promise<void>((resolve) => {
          setTimeout(() => {
            resolve();
          }, actualDelay);
        });
        break;
        
      case 'conditional':
        if (action.condition) {
          const conditionResult = action.condition();
          console.log(`🔀 Demo: Conditional check result: ${conditionResult}`);
          
          const actionsToExecute = conditionResult ? action.actionsIfTrue : action.actionsIfFalse;
          if (actionsToExecute && actionsToExecute.length > 0) {
            console.log(`📋 Demo: Executing ${actionsToExecute.length} conditional actions (${conditionResult ? 'true' : 'false'} branch)`);
            
            // Execute all actions in the conditional branch
            for (let i = 0; i < actionsToExecute.length; i++) {
              const conditionalAction = actionsToExecute[i];
              const conditionalDelay = (conditionalAction.delay || 1000) * speedMultipliers[config.speed];
              
              // Execute the conditional action
              await new Promise<void>((resolve) => {
                setTimeout(async () => {
                  await executeAction(conditionalAction);
                  resolve();
                }, conditionalDelay);
              });
            }
          } else {
            console.log(`⚠️ Demo: No actions defined for ${conditionResult ? 'true' : 'false'} branch`);
          }
        } else {
          console.warn(`⚠️ Demo: Conditional action has no condition function`);
        }
        break;
        
      case 'move':
        if (action.target) {
          const element = findElement(action.target);
          if (element) {
            const targetPos = getElementPosition(element);
            console.log(`🖱️ Demo: Moving to element "${action.target}" at position (${targetPos.x}, ${targetPos.y})`);
            animateMouseMove(currentPositionRef.current, targetPos, actualDelay);
          } else {
            console.warn(`⚠️ Demo: Element not found for target "${action.target}"`);
          }
        } else if (action.position) {
          console.log(`🖱️ Demo: Moving to absolute position (${action.position.x}, ${action.position.y})`);
          animateMouseMove(currentPositionRef.current, action.position, actualDelay);
        }
        break;
        
      case 'click':
        if (action.target) {
          const element = findElement(action.target);
          if (element) {
            const targetPos = getElementPosition(element);
            console.log(`👆 Demo: Clicking element "${action.target}" at (${targetPos.x}, ${targetPos.y})`);
            
            // Move to position first, then click
            animateMouseMove(currentPositionRef.current, targetPos, actualDelay);
            
            // Simulate click after movement
            setTimeout(() => {
              console.log(`✅ Demo: Executing click on "${action.target}"`);
              element.click();
            }, actualDelay);
          } else {
            console.warn(`⚠️ Demo: Cannot click - element not found for target "${action.target}"`);
          }
        }
        break;
        
      case 'type':
        if (action.target && action.text) {
          const element = findElement(action.target) as HTMLInputElement;
          if (element) {
            const targetPos = getElementPosition(element);
            console.log(`⌨️ Demo: Typing "${action.text}" into "${action.target}" at (${targetPos.x}, ${targetPos.y})`);
            
            // Move to position first, then type
            animateMouseMove(currentPositionRef.current, targetPos, actualDelay);
            
            setTimeout(() => {
              console.log(`✅ Demo: Executing type "${action.text}" into "${action.target}"`);
              element.focus();
              element.value = action.text!;
              element.dispatchEvent(new Event('input', { bubbles: true }));
            }, actualDelay);
          } else {
            console.warn(`⚠️ Demo: Cannot type - element not found for target "${action.target}"`);
          }
        }
        break;
        
      case 'scroll':
        console.log(`📜 Demo: Scroll action (not implemented)`);
        // Implement scroll simulation if needed
        break;
    }
  }, [config.speed, findElement, getElementPosition, animateMouseMove]);
  
  // Run next action - using refs to avoid closure issues
  const runNextAction = useCallback(() => {
    // Check if we should stop using refs
    if (!isActiveRef.current || userControlStatus === 'user') {
      console.log(`🛑 Demo: Stopping action execution`, {
        isActive: isActiveRef.current,
        userControlStatus,
        reason: !isActiveRef.current ? 'simulation stopped' : 'user has control'
      });
      return;
    }
    
    if (currentActionIndexRef.current >= config.actions.length) {
      if (config.loop) {
        console.log(`🔄 Demo: Restarting simulation loop (action ${currentActionIndexRef.current}/${config.actions.length})`);
        currentActionIndexRef.current = 0;
        setCurrentActionIndex(0);
      } else {
        console.log(`🏁 Demo: Simulation completed (no loop)`);
        stopRef.current();
        return;
      }
    }
    
    const action = config.actions[currentActionIndexRef.current];
    console.log(`📋 Demo: Processing action ${currentActionIndexRef.current + 1}/${config.actions.length}`);
    executeAction(action);
    
    const delay = (action.delay || 1000) * speedMultipliers[config.speed];
    timeoutRef.current = setTimeout(() => {
      currentActionIndexRef.current += 1;
      setCurrentActionIndex(currentActionIndexRef.current);
      runNextAction();
    }, delay);
  }, [userControlStatus, config.actions, config.loop, executeAction, config.speed]);

  // Start the simulation
  const startSimulation = useCallback(() => {
    if (!config.enabled || isActiveRef.current || userControlStatus === 'user') {
      console.log(`🚫 Demo: Cannot start simulation`, {
        enabled: config.enabled,
        isActive: isActiveRef.current,
        userControlStatus,
        reason: !config.enabled ? 'not enabled' : isActiveRef.current ? 'already active' : 'user has control'
      });
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
    setTimeout(() => runNextAction(), 100);
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
      console.log(`🎬 Demo: Cancelled animation frame`);
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      console.log(`⏰ Demo: Cleared timeout`);
    }
  }, []);

  // Keep stopRef in sync to avoid TDZ issues when referenced above
  useEffect(() => {
    stopRef.current = stopSimulation;
  }, [stopSimulation]);

  // Keep currentPositionRef in sync with currentPosition state
  useEffect(() => {
    currentPositionRef.current = currentPosition;
  }, [currentPosition]);
  
  // Handle postMessage events from parent window
  const handlePostMessage = useCallback((event: MessageEvent) => {
    // Only handle messages in demo mode (not Electron)
    if (isElectron) return;
    
    console.log(`📨 Demo: Received postMessage`, {
      type: event.data?.type,
      data: event.data?.data,
      origin: event.origin,
      timestamp: new Date().toISOString()
    });
    
    // Verify the message structure
    if (event.data && typeof event.data === 'object' && event.data.type === 'user-control-status') {
      const { control } = event.data.data;
      
      if (control === 'user') {
        // User is taking over - stop demo
        console.log(`👤 Demo: User taking control, stopping simulation`);
        setUserControlStatus('user');
        stopSimulation();
      } else if (control === 'demo') {
        // User handing control back to demo
        console.log(`🤖 Demo: User handing control back, resuming simulation`);
        setUserControlStatus('demo');
        // Auto-start simulation when control is handed back
        if (config.enabled) {
          console.log(`🔄 Demo: Auto-starting simulation after control handback`);
          startSimulation();
        } else {
          console.log(`⚠️ Demo: Cannot auto-start - simulation not enabled`);
        }
      } else {
        console.warn(`⚠️ Demo: Unknown control status "${control}"`);
      }
    } else {
      console.log(`📨 Demo: Ignoring non-control message`);
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
      console.log(`🚀 Demo: Auto-starting simulation (enabled: ${config.enabled}, control: ${userControlStatus}, active: ${isActive})`);
      startSimulation();
    }
  }, [isElectron, config.enabled, userControlStatus, isActive, startSimulation]);
  
  // Update config
  const updateConfig = useCallback((newConfig: Partial<MouseSimulationConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
  }, []);
  
  // Enable demo by default when in demo mode
  useEffect(() => {
    if (!isElectron && !config.enabled) {
      console.log(`🔧 Demo: Auto-enabling simulation in demo mode`);
      updateConfig({ enabled: true });
    }
  }, [isElectron, config.enabled, updateConfig]);
  
  // Toggle simulation (manual control)
  const toggleSimulation = useCallback(() => {
    if (userControlStatus === 'user') {
      console.log('Demo: Cannot toggle simulation while user has control');
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
