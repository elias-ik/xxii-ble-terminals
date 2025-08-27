# Design Language - XXII BLE Terminals

## Overview

XXII BLE Terminals uses a modern, accessible design system built on **Tailwind CSS** and **shadcn/ui** components. The design prioritizes clarity, functionality, and cross-platform consistency while supporting both light and dark themes.

## Core Design Principles

### 1. **Engineer-First UX**
- Clean, uncluttered interfaces optimized for technical workflows
- High information density without overwhelming the user
- Keyboard shortcuts and accessibility built-in from the start

### 2. **Theme-Aware Design**
- Automatic adaptation to system light/dark mode preferences
- Manual theme override capability
- Consistent visual hierarchy across themes

### 3. **Accessibility by Default**
- WCAG 2.1 AA compliance
- Screen reader support with proper ARIA labels
- High contrast ratios and focus indicators
- Keyboard navigation support

## Technology Stack

### **Tailwind CSS**
- Utility-first CSS framework for rapid development
- Custom design tokens for consistent spacing, colors, and typography
- Responsive design patterns
- Dark mode support via `dark:` prefix

### **shadcn/ui**
- High-quality, accessible React components
- Built on Radix UI primitives
- Customizable design tokens
- TypeScript-first development

### **Theme System**
- CSS custom properties for dynamic theming
- Tailwind semantic color tokens
- Automatic theme switching

## Color Scheme

### **Semantic Color Tokens**

The application uses semantic color tokens that automatically adapt to light/dark themes:

```css
/* Background Colors */
bg-background          /* Primary background */
bg-card               /* Card/surface background */
bg-popover            /* Popover/dropdown background */
bg-muted              /* Muted/subsidiary background */

/* Text Colors */
text-foreground       /* Primary text color */
text-muted-foreground /* Secondary/muted text */
text-card-foreground  /* Text on card backgrounds */

/* Border Colors */
border-border         /* Standard borders */
border-input          /* Input field borders */

/* Accent Colors */
accent-foreground     /* Accent text color */
```

### **Status Colors**

```css
/* Connection Status */
text-green-600        /* Connected - Excellent signal */
text-green-500        /* Connected - Good signal */
text-yellow-500       /* Connected - Fair signal */
text-orange-500       /* Connected - Poor signal */
text-red-500          /* Connected - Very poor signal */

/* Device States */
bg-green-100 text-green-800 border-green-200    /* Connected */
bg-yellow-100 text-yellow-800 border-yellow-200  /* Connecting */
bg-orange-100 text-orange-800 border-orange-200  /* Disconnecting */
bg-red-100 text-red-800 border-red-200          /* Lost/Error */
text-muted-foreground border-border              /* Disconnected */
```

### **RSSI Signal Strength**

```css
text-green-600        /* Excellent (-50 to -60 dBm) */
text-green-500        /* Good (-60 to -70 dBm) */
text-yellow-500       /* Fair (-70 to -80 dBm) */
text-orange-500       /* Poor (-80 to -90 dBm) */
text-red-500          /* Very Poor (-90+ dBm) */
```

## Component Usage Guidelines

### **Layout Components**

#### **Card**
```tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

<Card>
  <CardHeader>
    <CardTitle>Device Information</CardTitle>
    <CardDescription>BLE device details and status</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Content */}
  </CardContent>
</Card>
```

#### **Separator**
```tsx
import { Separator } from "@/components/ui/separator"

<div className="space-y-4">
  <div>Content above</div>
  <Separator />
  <div>Content below</div>
</div>
```

### **Navigation Components**

#### **Button**
```tsx
import { Button } from "@/components/ui/button"

// Primary actions
<Button>Connect Device</Button>

// Secondary actions
<Button variant="outline">Disconnect</Button>

// Destructive actions
<Button variant="destructive">Delete</Button>

// Ghost actions
<Button variant="ghost">Settings</Button>
```

#### **Tabs**
```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

<Tabs defaultValue="console" className="w-full">
  <TabsList>
    <TabsTrigger value="console">Console</TabsTrigger>
    <TabsTrigger value="settings">Settings</TabsTrigger>
  </TabsList>
  <TabsContent value="console">Console content</TabsContent>
  <TabsContent value="settings">Settings content</TabsContent>
</Tabs>
```

### **Form Components**

#### **Input**
```tsx
import { Input } from "@/components/ui/input"

<Input 
  placeholder="Search devices..." 
  className="pl-9 h-8 text-sm"
  aria-label="Search devices"
/>
```

#### **Select**
```tsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

<Select>
  <SelectTrigger>
    <SelectValue placeholder="Select format" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="hex">HEX</SelectItem>
    <SelectItem value="ascii">ASCII</SelectItem>
    <SelectItem value="utf8">UTF-8</SelectItem>
  </SelectContent>
</Select>
```

#### **Switch**
```tsx
import { Switch } from "@/components/ui/switch"

<div className="flex items-center space-x-2">
  <Switch id="notifications" />
  <Label htmlFor="notifications">Enable notifications</Label>
</div>
```

### **Feedback Components**

#### **Alert**
```tsx
import { Alert, AlertDescription } from "@/components/ui/alert"

<Alert>
  <AlertDescription>
    Device connected successfully
  </AlertDescription>
</Alert>
```

#### **Badge**
```tsx
import { Badge } from "@/components/ui/badge"

<Badge variant="secondary">Connected</Badge>
<Badge variant="destructive">Error</Badge>
```

#### **Progress**
```tsx
import { Progress } from "@/components/ui/progress"

<Progress value={75} className="w-full" />
```

### **Overlay Components**

#### **Dialog**
```tsx
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

<Dialog>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Confirm Action</DialogTitle>
      <DialogDescription>
        Are you sure you want to proceed?
      </DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <Button variant="outline">Cancel</Button>
      <Button>Confirm</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

#### **Popover**
```tsx
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

<Popover>
  <PopoverTrigger asChild>
    <Button variant="outline">Open settings</Button>
  </PopoverTrigger>
  <PopoverContent className="w-80">
    <div className="grid gap-4">
      <div className="space-y-2">
        <h4 className="font-medium leading-none">Settings</h4>
        <p className="text-sm text-muted-foreground">
          Configure your preferences
        </p>
      </div>
    </div>
  </PopoverContent>
</Popover>
```

## Typography

### **Font Stack**
```css
font-sans: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"
```

### **Text Sizes**
```css
text-xs    /* 12px - Small labels, badges */
text-sm    /* 14px - Body text, inputs */
text-base  /* 16px - Default body text */
text-lg    /* 18px - Headings */
text-xl    /* 20px - Large headings */
text-2xl   /* 24px - Page titles */
```

### **Font Weights**
```css
font-normal  /* 400 - Body text */
font-medium  /* 500 - Emphasis */
font-semibold /* 600 - Headings */
font-bold    /* 700 - Strong emphasis */
```

## Spacing System

### **Tailwind Spacing Scale**
```css
space-0     /* 0px */
space-1     /* 4px */
space-2     /* 8px */
space-3     /* 12px */
space-4     /* 16px */
space-6     /* 24px */
space-8     /* 32px */
space-12    /* 48px */
space-16    /* 64px */
```

### **Common Spacing Patterns**
```css
p-2         /* 8px padding */
p-4         /* 16px padding */
p-6         /* 24px padding */
gap-2       /* 8px gap */
gap-4       /* 16px gap */
space-y-2   /* 8px vertical spacing */
space-y-4   /* 16px vertical spacing */
```

## Layout Patterns

### **Flexbox Layouts**
```tsx
// Horizontal layout with space between
<div className="flex items-center justify-between">
  <div>Left content</div>
  <div>Right content</div>
</div>

// Vertical layout with consistent spacing
<div className="flex flex-col space-y-4">
  <div>Top content</div>
  <div>Bottom content</div>
</div>

// Centered content
<div className="flex items-center justify-center min-h-screen">
  <div>Centered content</div>
</div>
```

### **Grid Layouts**
```tsx
// Responsive grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  <div>Grid item 1</div>
  <div>Grid item 2</div>
  <div>Grid item 3</div>
</div>
```

## Responsive Design

### **Breakpoints**
```css
sm: 640px   /* Small devices */
md: 768px   /* Medium devices */
lg: 1024px  /* Large devices */
xl: 1280px  /* Extra large devices */
2xl: 1536px /* 2X large devices */
```

### **Responsive Patterns**
```tsx
// Responsive text sizing
<h1 className="text-lg md:text-xl lg:text-2xl">Responsive Heading</h1>

// Responsive spacing
<div className="p-2 md:p-4 lg:p-6">Responsive padding</div>

// Responsive layout
<div className="flex flex-col md:flex-row">Responsive layout</div>
```

## Accessibility Guidelines

### **Color Contrast**
- Minimum contrast ratio: 4.5:1 for normal text
- Minimum contrast ratio: 3:1 for large text
- Use semantic color tokens for automatic theme adaptation

### **Focus Indicators**
```css
/* Default focus ring */
focus:ring-2 focus:ring-ring focus:ring-offset-2

/* Custom focus styles */
focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
```

### **ARIA Labels**
```tsx
<Button aria-label="Connect to device">Connect</Button>
<Input aria-label="Search devices" placeholder="Search..." />
```

## Animation and Transitions

### **Smooth Transitions**
```css
/* Default transition */
transition-colors duration-200

/* Custom transitions */
transition-all duration-300 ease-in-out
```

### **Loading States**
```tsx
// Spinning icon
<RefreshCw className="animate-spin" />

// Pulse animation
<div className="animate-pulse">Loading...</div>
```

## Best Practices

### **1. Always Use Semantic Colors**
```tsx
// ✅ Good - Uses semantic tokens
<div className="bg-background text-foreground border-border">

// ❌ Bad - Uses hardcoded colors
<div className="bg-white text-black border-gray-200">
```

### **2. Consistent Component Usage**
```tsx
// ✅ Good - Uses shadcn/ui components
import { Button } from "@/components/ui/button"
<Button variant="outline">Action</Button>

// ❌ Bad - Custom button implementation
<button className="px-4 py-2 border rounded">Action</button>
```

### **3. Responsive Design**
```tsx
// ✅ Good - Responsive design
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">

// ❌ Bad - Fixed layout
<div className="grid grid-cols-2 gap-4">
```

### **4. Accessibility First**
```tsx
// ✅ Good - Includes ARIA labels
<Button aria-label="Connect device">Connect</Button>

// ❌ Bad - No accessibility support
<Button>Connect</Button>
```

## Theme Customization

### **Custom CSS Variables**
```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --card: 0 0% 100%;
  --card-foreground: 222.2 84% 4.9%;
  --popover: 0 0% 100%;
  --popover-foreground: 222.2 84% 4.9%;
  --primary: 222.2 47.4% 11.2%;
  --primary-foreground: 210 40% 98%;
  --secondary: 210 40% 96%;
  --secondary-foreground: 222.2 84% 4.9%;
  --muted: 210 40% 96%;
  --muted-foreground: 215.4 16.3% 46.9%;
  --accent: 210 40% 96%;
  --accent-foreground: 222.2 84% 4.9%;
  --destructive: 0 84.2% 60.2%;
  --destructive-foreground: 210 40% 98%;
  --border: 214.3 31.8% 91.4%;
  --input: 214.3 31.8% 91.4%;
  --ring: 222.2 84% 4.9%;
  --radius: 0.5rem;
}

.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  --card: 222.2 84% 4.9%;
  --card-foreground: 210 40% 98%;
  --popover: 222.2 84% 4.9%;
  --popover-foreground: 210 40% 98%;
  --primary: 210 40% 98%;
  --primary-foreground: 222.2 47.4% 11.2%;
  --secondary: 217.2 32.6% 17.5%;
  --secondary-foreground: 210 40% 98%;
  --muted: 217.2 32.6% 17.5%;
  --muted-foreground: 215 20.2% 65.1%;
  --accent: 217.2 32.6% 17.5%;
  --accent-foreground: 210 40% 98%;
  --destructive: 0 62.8% 30.6%;
  --destructive-foreground: 210 40% 98%;
  --border: 217.2 32.6% 17.5%;
  --input: 217.2 32.6% 17.5%;
  --ring: 212.7 26.8% 83.9%;
}
```

This design language ensures consistency, accessibility, and maintainability across the XXII BLE Terminals application while providing a professional, engineer-focused user experience.
