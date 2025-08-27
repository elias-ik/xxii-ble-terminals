import { useEffect, useRef, useCallback, useState } from 'react';
import { isElectron } from '@/lib/env';
import { useBLEStore } from '@/lib/ble-store';

export interface MousePosition {
  x: number;
  y: number;
}

export interface MouseAction {
  type: 'move' | 'click' | 'type' | 'scroll';
  target?: string;
  position?: MousePosition;
  text?: string;
  delay?: number;
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
  { type: 'move', position: { x: 100, y: 100 }, delay: 2000 },
  
  // Step 1: Start scanning for devices
  { type: 'move', target: '[data-testid="scan-button"]', delay: 1500 },
  { type: 'click', target: '[data-testid="scan-button"]', delay: 3000 },
  
  // Step 2: Wait for devices to appear and select the first one
  { type: 'move', target: '[data-testid="device-row"]', delay: 4000 },
  { type: 'click', target: '[data-testid="device-row"]', delay: 2000 },
  
  // Step 3: Connect to the selected device
  { type: 'move', target: '[data-testid="connect-button"]', delay: 1500 },
  { type: 'click', target: '[data-testid="connect-button"]', delay: 3000 },
  
  // Step 4: Send first command - AT+VERSION
  { type: 'move', target: '[data-testid="terminal-input"]', delay: 2000 },
  { type: 'click', target: '[data-testid="terminal-input"]', delay: 1000 },
  { type: 'type', text: 'AT+VERSION', delay: 2000 },
  { type: 'click', target: '[data-testid="send-button"]', delay: 2000 },
  
  // Step 5: Send second command - AT+STATUS
  { type: 'type', text: 'AT+STATUS', delay: 2000 },
  { type: 'click', target: '[data-testid="send-button"]', delay: 2000 },
  
  // Step 6: Send third command - AT+INFO
  { type: 'type', text: 'AT+INFO', delay: 2000 },
  { type: 'click', target: '[data-testid="send-button"]', delay: 2000 },
  
  // Step 7: Subscribe to notifications (click on a notify badge)
  { type: 'move', target: '[data-testid="subscribe-button"]', delay: 2000 },
  { type: 'click', target: '[data-testid="subscribe-button"]', delay: 3000 },
  
  // Step 8: Clear the console
  { type: 'move', target: '[data-testid="clear-console-button"]', delay: 1500 },
  { type: 'click', target: '[data-testid="clear-console-button"]', delay: 2000 },
  
  // Step 9: Send one more command after clearing
  { type: 'move', target: '[data-testid="terminal-input"]', delay: 1500 },
  { type: 'click', target: '[data-testid="terminal-input"]', delay: 1000 },
  { type: 'type', text: 'HELLO WORLD', delay: 2000 },
  { type: 'click', target: '[data-testid="send-button"]', delay: 2000 },
  
  // Step 10: Disconnect from the device
  { type: 'move', target: '[data-testid="disconnect-button"]', delay: 2000 },
  { type: 'click', target: '[data-testid="disconnect-button"]', delay: 3000 },
  
  // Final pause before restarting
  { type: 'move', position: { x: 100, y: 100 }, delay: 2000 },
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
  const animationRef = useRef<number>();
  const timeoutRef = useRef<NodeJS.Timeout>();
  const hasStartedRef = useRef<boolean>(false);
  const isActiveRef = useRef<boolean>(false);
  const currentActionIndexRef = useRef<number>(0);
  
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
      
      setCurrentPosition({ x, y });
      
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
      target: action.target,
      position: action.position,
      text: action.text,
      delay: `${baseDelay}ms → ${actualDelay}ms (${config.speed} speed)`,
      timestamp: new Date().toISOString()
    });
    
    switch (action.type) {
      case 'move':
        if (action.target) {
          const element = findElement(action.target);
          if (element) {
            const targetPos = getElementPosition(element);
            console.log(`🖱️ Demo: Moving to element "${action.target}" at position (${targetPos.x}, ${targetPos.y})`);
            animateMouseMove(currentPosition, targetPos, actualDelay);
            setCurrentPosition(targetPos);
          } else {
            console.warn(`⚠️ Demo: Element not found for target "${action.target}"`);
          }
        } else if (action.position) {
          console.log(`🖱️ Demo: Moving to absolute position (${action.position.x}, ${action.position.y})`);
          animateMouseMove(currentPosition, action.position, actualDelay);
          setCurrentPosition(action.position);
        }
        break;
        
      case 'click':
        if (action.target) {
          const element = findElement(action.target);
          if (element) {
            const targetPos = getElementPosition(element);
            setCurrentPosition(targetPos);
            console.log(`👆 Demo: Clicking element "${action.target}" at (${targetPos.x}, ${targetPos.y})`);
            
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
            setCurrentPosition(targetPos);
            console.log(`⌨️ Demo: Typing "${action.text}" into "${action.target}" at (${targetPos.x}, ${targetPos.y})`);
            
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
  }, [currentPosition, config.speed, findElement, getElementPosition, animateMouseMove]);
  
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
        stopSimulation();
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
  }, [userControlStatus, config.actions, config.loop, executeAction, speedMultipliers, config.speed, stopSimulation]);

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
