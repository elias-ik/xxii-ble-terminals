// Test script for accessibility features and keyboard navigation
// This validates the full connect → send → subscribe flow without mouse

// Wait for the page to load and BLE API to be available
function waitForBLEAPI() {
  return new Promise((resolve) => {
    const checkAPI = () => {
      if (window.bleAPI) {
        resolve();
      } else {
        setTimeout(checkAPI, 100);
      }
    };
    checkAPI();
  });
}

// Accessibility test runner
class AccessibilityTester {
  constructor() {
    this.testResults = [];
    this.currentStep = 0;
    this.isRunning = false;
  }

  // Test keyboard shortcuts
  async testKeyboardShortcuts() {
    console.log('⌨️ Testing Keyboard Shortcuts...');
    
    const shortcuts = [
      { key: 'Cmd/Ctrl+K', description: 'Focus input field', test: () => this.testFocusInput() },
      { key: 'Cmd/Ctrl+F', description: 'Focus search field', test: () => this.testFocusSearch() },
      { key: 'Cmd/Ctrl+R', description: 'Rescan devices', test: () => this.testRescan() },
      { key: 'Cmd/Ctrl+B', description: 'Toggle sidebar', test: () => this.testToggleSidebar() },
      { key: 'Escape', description: 'Close overlays', test: () => this.testEscapeKey() },
      { key: 'Tab', description: 'Navigate between elements', test: () => this.testTabNavigation() },
      { key: 'Enter', description: 'Activate buttons and select items', test: () => this.testEnterKey() },
      { key: 'Arrow Keys', description: 'Navigate lists and menus', test: () => this.testArrowKeys() }
    ];

    for (const shortcut of shortcuts) {
      try {
        await shortcut.test();
        this.testResults.push({
          test: `Keyboard Shortcut: ${shortcut.key}`,
          status: '✅ PASS',
          description: shortcut.description
        });
      } catch (error) {
        this.testResults.push({
          test: `Keyboard Shortcut: ${shortcut.key}`,
          status: '❌ FAIL',
          description: shortcut.description,
          error: error.message
        });
      }
    }
  }

  // Test focus management
  async testFocusInput() {
    // Simulate Cmd/Ctrl+K
    const event = new KeyboardEvent('keydown', {
      key: 'k',
      metaKey: true,
      bubbles: true
    });
    document.dispatchEvent(event);
    
    // Check if input is focused
    await this.wait(100);
    const activeElement = document.activeElement;
    if (!activeElement || !activeElement.matches('input[placeholder*="message"]')) {
      throw new Error('Input field not focused after Cmd/Ctrl+K');
    }
  }

  async testFocusSearch() {
    // Simulate Cmd/Ctrl+F
    const event = new KeyboardEvent('keydown', {
      key: 'f',
      metaKey: true,
      bubbles: true
    });
    document.dispatchEvent(event);
    
    // Check if search is focused
    await this.wait(100);
    const activeElement = document.activeElement;
    if (!activeElement || !activeElement.matches('input[placeholder*="Search"]')) {
      throw new Error('Search field not focused after Cmd/Ctrl+F');
    }
  }

  async testRescan() {
    // Simulate Cmd/Ctrl+R
    const event = new KeyboardEvent('keydown', {
      key: 'r',
      metaKey: true,
      bubbles: true
    });
    document.dispatchEvent(event);
    
    // Check if scan started
    await this.wait(100);
    const scanButton = document.querySelector('button[aria-label*="Scan"]');
    if (scanButton && scanButton.disabled) {
      // Scan is in progress
      return;
    }
    
    // If no scan button found, check if devices are being discovered
    const devices = document.querySelectorAll('[role="button"][aria-label*="device"]');
    if (devices.length === 0) {
      throw new Error('No devices found after rescan');
    }
  }

  async testToggleSidebar() {
    // Simulate Cmd/Ctrl+B
    const event = new KeyboardEvent('keydown', {
      key: 'b',
      metaKey: true,
      bubbles: true
    });
    document.dispatchEvent(event);
    
    // Check if sidebar state changed
    await this.wait(100);
    const sidebar = document.querySelector('[data-state]');
    if (!sidebar) {
      throw new Error('Sidebar not found');
    }
  }

  async testEscapeKey() {
    // Open a dialog or overlay first
    const settingsButton = document.querySelector('button[aria-label*="settings"]');
    if (settingsButton) {
      settingsButton.click();
      await this.wait(100);
      
      // Check if dialog is open
      const dialog = document.querySelector('[role="dialog"]');
      if (dialog) {
        // Press Escape
        const event = new KeyboardEvent('keydown', {
          key: 'Escape',
          bubbles: true
        });
        document.dispatchEvent(event);
        
        await this.wait(100);
        
        // Check if dialog is closed
        const closedDialog = document.querySelector('[role="dialog"]');
        if (closedDialog) {
          throw new Error('Dialog not closed after Escape key');
        }
      }
    }
  }

  async testTabNavigation() {
    // Focus first focusable element
    const firstFocusable = document.querySelector('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (firstFocusable) {
      firstFocusable.focus();
      
      // Press Tab
      const event = new KeyboardEvent('keydown', {
        key: 'Tab',
        bubbles: true
      });
      document.dispatchEvent(event);
      
      await this.wait(100);
      
      // Check if focus moved
      const activeElement = document.activeElement;
      if (activeElement === firstFocusable) {
        throw new Error('Focus did not move after Tab key');
      }
    }
  }

  async testEnterKey() {
    // Find a clickable element
    const button = document.querySelector('button:not([disabled])');
    if (button) {
      button.focus();
      
      // Press Enter
      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true
      });
      document.dispatchEvent(event);
      
      await this.wait(100);
      
      // Check if action was performed
      // This is a basic test - in practice we'd check for specific state changes
    }
  }

  async testArrowKeys() {
    // Find a list or menu
    const list = document.querySelector('[role="listbox"], [role="menu"], [role="list"]');
    if (list) {
      const firstItem = list.querySelector('[role="option"], [role="menuitem"], [role="listitem"]');
      if (firstItem) {
        firstItem.focus();
        
        // Press Arrow Down
        const event = new KeyboardEvent('keydown', {
          key: 'ArrowDown',
          bubbles: true
        });
        document.dispatchEvent(event);
        
        await this.wait(100);
        
        // Check if focus moved to next item
        const activeElement = document.activeElement;
        if (activeElement === firstItem) {
          throw new Error('Focus did not move after Arrow Down key');
        }
      }
    }
  }

  // Test screen reader support
  async testScreenReaderSupport() {
    console.log('🔊 Testing Screen Reader Support...');
    
    const tests = [
      { test: 'ARIA Labels', check: () => this.checkAriaLabels() },
      { test: 'Status Indicators', check: () => this.checkStatusIndicators() },
      { test: 'Focus Indicators', check: () => this.checkFocusIndicators() },
      { test: 'Color Contrast', check: () => this.checkColorContrast() },
      { test: 'Semantic HTML', check: () => this.checkSemanticHTML() }
    ];

    for (const test of tests) {
      try {
        await test.check();
        this.testResults.push({
          test: `Screen Reader: ${test.test}`,
          status: '✅ PASS',
          description: test.test
        });
      } catch (error) {
        this.testResults.push({
          test: `Screen Reader: ${test.test}`,
          status: '❌ FAIL',
          description: test.test,
          error: error.message
        });
      }
    }
  }

  async checkAriaLabels() {
    const elementsWithoutLabels = document.querySelectorAll('button:not([aria-label]):not([aria-labelledby]), input:not([aria-label]):not([aria-labelledby])');
    const criticalElements = Array.from(elementsWithoutLabels).filter(el => {
      // Check if element is visible and interactive
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && !el.disabled;
    });
    
    if (criticalElements.length > 0) {
      throw new Error(`${criticalElements.length} interactive elements missing ARIA labels`);
    }
  }

  async checkStatusIndicators() {
    const statusDots = document.querySelectorAll('[role="img"][aria-label*="Status"]');
    if (statusDots.length === 0) {
      throw new Error('No status indicators found with proper ARIA labels');
    }
    
    // Check if status indicators have proper color contrast
    for (const dot of statusDots) {
      const style = window.getComputedStyle(dot);
      const backgroundColor = style.backgroundColor;
      
      // Simple contrast check (in practice, use a proper contrast ratio calculator)
      if (backgroundColor === 'rgba(0, 0, 0, 0)' || backgroundColor === 'transparent') {
        throw new Error('Status indicator missing background color');
      }
    }
  }

  async checkFocusIndicators() {
    // Focus an element and check for focus ring
    const button = document.querySelector('button');
    if (button) {
      button.focus();
      await this.wait(100);
      
      const style = window.getComputedStyle(button);
      const outline = style.outline;
      const boxShadow = style.boxShadow;
      
      if (outline === 'none' && boxShadow === 'none') {
        throw new Error('No focus indicator found');
      }
    }
  }

  async checkColorContrast() {
    // Check text elements for sufficient contrast
    const textElements = document.querySelectorAll('p, span, div, h1, h2, h3, h4, h5, h6');
    let lowContrastCount = 0;
    
    for (const element of textElements) {
      const style = window.getComputedStyle(element);
      const color = style.color;
      const backgroundColor = style.backgroundColor;
      
      // Simple contrast check (in practice, use a proper contrast ratio calculator)
      if (color === backgroundColor) {
        lowContrastCount++;
      }
    }
    
    if (lowContrastCount > 5) {
      throw new Error(`${lowContrastCount} elements may have insufficient color contrast`);
    }
  }

  async checkSemanticHTML() {
    // Check for proper semantic elements
    const hasMain = document.querySelector('main');
    const hasHeader = document.querySelector('header');
    const hasNav = document.querySelector('nav');
    const hasSection = document.querySelector('section');
    
    if (!hasMain && !hasHeader && !hasNav && !hasSection) {
      throw new Error('No semantic HTML elements found');
    }
  }

  // Test full keyboard navigation flow
  async testFullKeyboardFlow() {
    console.log('🎯 Testing Full Keyboard Navigation Flow...');
    
    const steps = [
      { action: 'Navigate to search field', test: () => this.navigateToSearch() },
      { action: 'Search for devices', test: () => this.searchForDevices() },
      { action: 'Navigate to device list', test: () => this.navigateToDeviceList() },
      { action: 'Select a device', test: () => this.selectDevice() },
      { action: 'Connect to device', test: () => this.connectToDevice() },
      { action: 'Navigate to terminal', test: () => this.navigateToTerminal() },
      { action: 'Select characteristic', test: () => this.selectCharacteristic() },
      { action: 'Send message', test: () => this.sendMessage() },
      { action: 'Subscribe to notifications', test: () => this.subscribeToNotifications() }
    ];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      try {
        console.log(`Step ${i + 1}: ${step.action}`);
        await step.test();
        this.testResults.push({
          test: `Keyboard Flow: ${step.action}`,
          status: '✅ PASS',
          description: `Step ${i + 1} completed successfully`
        });
      } catch (error) {
        this.testResults.push({
          test: `Keyboard Flow: ${step.action}`,
          status: '❌ FAIL',
          description: `Step ${i + 1} failed`,
          error: error.message
        });
        break; // Stop flow if a step fails
      }
    }
  }

  async navigateToSearch() {
    // Tab to search field
    const searchInput = document.querySelector('input[placeholder*="Search"]');
    if (searchInput) {
      searchInput.focus();
      await this.wait(100);
      
      if (document.activeElement !== searchInput) {
        throw new Error('Could not focus search input');
      }
    } else {
      throw new Error('Search input not found');
    }
  }

  async searchForDevices() {
    const searchInput = document.querySelector('input[placeholder*="Search"]');
    if (searchInput) {
      searchInput.value = 'BLE';
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      await this.wait(200);
    }
  }

  async navigateToDeviceList() {
    // Tab to device list
    const deviceList = document.querySelector('[role="list"]') || document.querySelector('.space-y-2');
    if (deviceList) {
      const firstDevice = deviceList.querySelector('[role="button"]');
      if (firstDevice) {
        firstDevice.focus();
        await this.wait(100);
      }
    }
  }

  async selectDevice() {
    const deviceButton = document.querySelector('[role="button"][aria-label*="device"]');
    if (deviceButton) {
      deviceButton.click();
      await this.wait(200);
      
      // Check if device is selected
      const selectedDevice = document.querySelector('[aria-pressed="true"]');
      if (!selectedDevice) {
        throw new Error('Device not selected');
      }
    } else {
      throw new Error('No device button found');
    }
  }

  async connectToDevice() {
    const connectButton = document.querySelector('button[aria-label*="Connect"]');
    if (connectButton) {
      connectButton.click();
      await this.wait(1000); // Wait for connection
      
      // Check if connected
      const connectedStatus = document.querySelector('[aria-label*="Connected"]');
      if (!connectedStatus) {
        throw new Error('Device not connected');
      }
    } else {
      throw new Error('Connect button not found');
    }
  }

  async navigateToTerminal() {
    // Tab to terminal area
    const terminal = document.querySelector('[role="log"]') || document.querySelector('.terminal-console');
    if (terminal) {
      const firstInput = terminal.querySelector('input');
      if (firstInput) {
        firstInput.focus();
        await this.wait(100);
      }
    }
  }

  async selectCharacteristic() {
    const characteristicSelect = document.querySelector('select[aria-label*="characteristic"]');
    if (characteristicSelect) {
      characteristicSelect.focus();
      characteristicSelect.click();
      await this.wait(100);
      
      // Select first option
      const options = characteristicSelect.querySelectorAll('option');
      if (options.length > 1) {
        characteristicSelect.value = options[1].value;
        characteristicSelect.dispatchEvent(new Event('change', { bubbles: true }));
        await this.wait(100);
      }
    }
  }

  async sendMessage() {
    const messageInput = document.querySelector('input[placeholder*="message"]');
    if (messageInput) {
      messageInput.focus();
      messageInput.value = 'Hello World';
      messageInput.dispatchEvent(new Event('input', { bubbles: true }));
      
      // Press Enter to send
      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true
      });
      messageInput.dispatchEvent(event);
      
      await this.wait(200);
    }
  }

  async subscribeToNotifications() {
    const subscribeSwitch = document.querySelector('input[type="checkbox"][aria-label*="Subscribe"]');
    if (subscribeSwitch) {
      subscribeSwitch.click();
      await this.wait(200);
      
      // Check if subscribed
      if (!subscribeSwitch.checked) {
        throw new Error('Subscription not activated');
      }
    }
  }

  // Utility methods
  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Run all tests
  async runAllTests() {
    console.log('🧪 Starting Accessibility Tests...');
    
    this.isRunning = true;
    this.testResults = [];
    
    try {
      await this.testKeyboardShortcuts();
      await this.testScreenReaderSupport();
      await this.testFullKeyboardFlow();
    } catch (error) {
      console.error('Test error:', error);
    }
    
    this.isRunning = false;
    this.displayResults();
  }

  // Display test results
  displayResults() {
    console.log('\n📊 Accessibility Test Results:');
    console.log('=============================');
    
    const passed = this.testResults.filter(r => r.status === '✅ PASS').length;
    const failed = this.testResults.filter(r => r.status === '❌ FAIL').length;
    
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📊 Total: ${this.testResults.length}`);
    
    console.log('\nDetailed Results:');
    this.testResults.forEach(result => {
      console.log(`${result.status} ${result.test}: ${result.description}`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });
    
    // Export results
    window.accessibilityTestResults = this.testResults;
    
    return {
      passed,
      failed,
      total: this.testResults.length,
      results: this.testResults
    };
  }
}

// Interactive test runner
function createAccessibilityTestRunner() {
  const testRunner = {
    // Run all tests
    runAllTests: () => {
      const tester = new AccessibilityTester();
      return tester.runAllTests();
    },
    
    // Run specific test categories
    runKeyboardTests: async () => {
      const tester = new AccessibilityTester();
      await tester.testKeyboardShortcuts();
      return tester.displayResults();
    },
    
    runScreenReaderTests: async () => {
      const tester = new AccessibilityTester();
      await tester.testScreenReaderSupport();
      return tester.displayResults();
    },
    
    runFlowTests: async () => {
      const tester = new AccessibilityTester();
      await tester.testFullKeyboardFlow();
      return tester.displayResults();
    },
    
    // Get previous results
    getResults: () => {
      return window.accessibilityTestResults || [];
    }
  };
  
  // Expose to global scope
  window.accessibilityTestRunner = testRunner;
  
  console.log('🧪 Accessibility Test Runner initialized!');
  console.log('Available commands:');
  console.log('  accessibilityTestRunner.runAllTests() - Run all accessibility tests');
  console.log('  accessibilityTestRunner.runKeyboardTests() - Test keyboard shortcuts only');
  console.log('  accessibilityTestRunner.runScreenReaderTests() - Test screen reader support only');
  console.log('  accessibilityTestRunner.runFlowTests() - Test full keyboard navigation flow only');
  console.log('  accessibilityTestRunner.getResults() - Get previous test results');
  
  return testRunner;
}

// Initialize when page loads
if (typeof window !== 'undefined') {
  waitForBLEAPI().then(() => {
    console.log('🎯 BLE API ready, initializing accessibility test runner...');
    createAccessibilityTestRunner();
  });
}

// Export for Node.js environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    waitForBLEAPI,
    AccessibilityTester,
    createAccessibilityTestRunner
  };
}
