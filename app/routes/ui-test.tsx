import type { Route } from "./+types/ui-test";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Switch } from "../components/ui/switch";
import { Checkbox } from "../components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";
import { Slider } from "../components/ui/slider";
import { Progress } from "../components/ui/progress";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Skeleton } from "../components/ui/skeleton";
import { Separator } from "../components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { AlertCircle, CheckCircle, Info, Loader2, Search, X } from "lucide-react";
import { useState } from "react";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "UI Test - XXII BLE Terminals" },
    { name: "description", content: "UI Component Showcase" },
  ];
}

interface ComponentDemoProps {
  title: string;
  description: string;
  children: React.ReactNode;
  code?: string;
  props?: Array<{ name: string; type: string; description: string }>;
}

function ComponentDemo({ title, description, children, code, props }: ComponentDemoProps) {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 border rounded-lg bg-muted/50">
          {children}
        </div>
        {code && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Usage:</Label>
            <pre className="p-3 bg-muted rounded text-xs overflow-x-auto">
              <code>{code}</code>
            </pre>
          </div>
        )}
        {props && props.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Props:</Label>
            <div className="border rounded">
              <table className="w-full text-xs">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="p-2 text-left">Name</th>
                    <th className="p-2 text-left">Type</th>
                    <th className="p-2 text-left">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {props.map((prop, index) => (
                    <tr key={index} className="border-t">
                      <td className="p-2 font-mono">{prop.name}</td>
                      <td className="p-2 font-mono">{prop.type}</td>
                      <td className="p-2">{prop.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function UITest() {
  const [sliderValue, setSliderValue] = useState([50]);
  const [progressValue, setProgressValue] = useState(65);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-foreground">UI Component Test</h1>
          <Button variant="outline" onClick={() => window.history.back()}>
            ← Back
          </Button>
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Introduction */}
          <Card>
            <CardHeader>
              <CardTitle>UI Component Showcase</CardTitle>
              <CardDescription>
                This page demonstrates all available shadcn/ui components with different states, variants, and proper documentation.
                Test the dark/light mode toggle to see how components adapt to different themes.
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Buttons */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Buttons</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <ComponentDemo
                title="Button Variants"
                description="Different button styles and states"
                code={`<Button variant="default">Default</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="destructive">Destructive</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>`}
                props={[
                  { name: "variant", type: "string", description: "Button style variant" },
                  { name: "size", type: "string", description: "Button size (default, sm, lg)" },
                  { name: "disabled", type: "boolean", description: "Disable the button" }
                ]}
              >
                <div className="flex flex-wrap gap-2">
                  <Button variant="default">Default</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="destructive">Destructive</Button>
                  <Button variant="outline">Outline</Button>
                  <Button variant="ghost">Ghost</Button>
                </div>
              </ComponentDemo>

              <ComponentDemo
                title="Button Sizes"
                description="Different button sizes"
                code={`<Button size="sm">Small</Button>
<Button size="default">Default</Button>
<Button size="lg">Large</Button>`}
              >
                <div className="flex flex-wrap gap-2 items-center">
                  <Button size="sm">Small</Button>
                  <Button size="default">Default</Button>
                  <Button size="lg">Large</Button>
                </div>
              </ComponentDemo>

              <ComponentDemo
                title="Button States"
                description="Loading and disabled states"
                code={`<Button disabled>Disabled</Button>
<Button>
  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
  Loading
</Button>`}
              >
                <div className="flex flex-wrap gap-2">
                  <Button disabled>Disabled</Button>
                  <Button>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading
                  </Button>
                </div>
              </ComponentDemo>
            </div>
          </div>

          {/* Form Elements */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Form Elements</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <ComponentDemo
                title="Input Fields"
                description="Text input with different states"
                code={`<Input placeholder="Enter text..." />
<Input disabled placeholder="Disabled input" />
<Input type="password" placeholder="Password" />`}
              >
                <div className="space-y-2">
                  <Input placeholder="Enter text..." />
                  <Input disabled placeholder="Disabled input" />
                  <Input type="password" placeholder="Password" />
                </div>
              </ComponentDemo>

              <ComponentDemo
                title="Textarea"
                description="Multi-line text input"
                code={`<Textarea placeholder="Enter long text..." />
<Textarea disabled placeholder="Disabled textarea" />`}
              >
                <div className="space-y-2">
                  <Textarea placeholder="Enter long text..." />
                  <Textarea disabled placeholder="Disabled textarea" />
                </div>
              </ComponentDemo>

              <ComponentDemo
                title="Select Dropdown"
                description="Dropdown selection component"
                code={`<Select>
  <SelectTrigger>
    <SelectValue placeholder="Select option" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="option1">Option 1</SelectItem>
    <SelectItem value="option2">Option 2</SelectItem>
  </SelectContent>
</Select>`}
              >
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select option" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="option1">Option 1</SelectItem>
                    <SelectItem value="option2">Option 2</SelectItem>
                    <SelectItem value="option3">Option 3</SelectItem>
                  </SelectContent>
                </Select>
              </ComponentDemo>

              <ComponentDemo
                title="Checkbox"
                description="Checkbox input with label"
                code={`<div className="flex items-center space-x-2">
  <Checkbox id="terms" />
  <Label htmlFor="terms">Accept terms</Label>
</div>`}
              >
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="terms" />
                    <Label htmlFor="terms">Accept terms</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="newsletter" defaultChecked />
                    <Label htmlFor="newsletter">Subscribe to newsletter</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="disabled" disabled />
                    <Label htmlFor="disabled" className="text-muted-foreground">Disabled option</Label>
                  </div>
                </div>
              </ComponentDemo>

              <ComponentDemo
                title="Radio Group"
                description="Radio button selection"
                code={`<RadioGroup defaultValue="option1">
  <div className="flex items-center space-x-2">
    <RadioGroupItem value="option1" id="r1" />
    <Label htmlFor="r1">Option 1</Label>
  </div>
</RadioGroup>`}
              >
                <RadioGroup defaultValue="option1">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="option1" id="r1" />
                      <Label htmlFor="r1">Option 1</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="option2" id="r2" />
                      <Label htmlFor="r2">Option 2</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="option3" id="r3" />
                      <Label htmlFor="r3">Option 3</Label>
                    </div>
                  </div>
                </RadioGroup>
              </ComponentDemo>

              <ComponentDemo
                title="Switch Toggle"
                description="Toggle switch component"
                code={`<div className="flex items-center space-x-2">
  <Switch id="airplane-mode" />
  <Label htmlFor="airplane-mode">Airplane mode</Label>
</div>`}
              >
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Switch id="airplane-mode" />
                    <Label htmlFor="airplane-mode">Airplane mode</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch id="notifications" defaultChecked />
                    <Label htmlFor="notifications">Notifications</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch id="disabled-switch" disabled />
                    <Label htmlFor="disabled-switch" className="text-muted-foreground">Disabled switch</Label>
                  </div>
                </div>
              </ComponentDemo>
            </div>
          </div>

          {/* Feedback Components */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Feedback Components</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <ComponentDemo
                title="Badges"
                description="Status and category indicators"
                code={`<Badge variant="default">Default</Badge>
<Badge variant="secondary">Secondary</Badge>
<Badge variant="destructive">Destructive</Badge>
<Badge variant="outline">Outline</Badge>`}
              >
                <div className="flex flex-wrap gap-2">
                  <Badge variant="default">Default</Badge>
                  <Badge variant="secondary">Secondary</Badge>
                  <Badge variant="destructive">Destructive</Badge>
                  <Badge variant="outline">Outline</Badge>
                </div>
              </ComponentDemo>

              <ComponentDemo
                title="Alerts"
                description="Information and warning messages"
                code={`<Alert>
  <Info className="h-4 w-4" />
  <AlertDescription>This is an informational alert.</AlertDescription>
</Alert>`}
              >
                <div className="space-y-2">
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>This is an informational alert.</AlertDescription>
                  </Alert>
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>This is a destructive alert.</AlertDescription>
                  </Alert>
                </div>
              </ComponentDemo>

              <ComponentDemo
                title="Progress Bar"
                description="Progress indicator"
                code={`<Progress value={65} className="w-full" />`}
              >
                <div className="space-y-2">
                  <Progress value={progressValue} className="w-full" />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => setProgressValue(Math.max(0, progressValue - 10))}>
                      Decrease
                    </Button>
                    <Button size="sm" onClick={() => setProgressValue(Math.min(100, progressValue + 10))}>
                      Increase
                    </Button>
                  </div>
                </div>
              </ComponentDemo>

              <ComponentDemo
                title="Skeleton Loading"
                description="Loading placeholders"
                code={`<div className="space-y-2">
  <Skeleton className="h-4 w-full" />
  <Skeleton className="h-4 w-3/4" />
  <Skeleton className="h-4 w-1/2" />
</div>`}
              >
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </ComponentDemo>
            </div>
          </div>

          {/* Interactive Components */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Interactive Components</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <ComponentDemo
                title="Slider"
                description="Range slider input"
                code={`<Slider
  value={sliderValue}
  onValueChange={setSliderValue}
  max={100}
  step={1}
/>`}
              >
                <div className="space-y-4">
                  <Slider
                    value={sliderValue}
                    onValueChange={setSliderValue}
                    max={100}
                    step={1}
                    className="w-full"
                  />
                  <div className="text-sm text-muted-foreground">
                    Value: {sliderValue[0]}
                  </div>
                </div>
              </ComponentDemo>

              <ComponentDemo
                title="Tabs"
                description="Tabbed interface"
                code={`<Tabs defaultValue="account">
  <TabsList>
    <TabsTrigger value="account">Account</TabsTrigger>
    <TabsTrigger value="password">Password</TabsTrigger>
  </TabsList>
  <TabsContent value="account">Account content</TabsContent>
  <TabsContent value="password">Password content</TabsContent>
</Tabs>`}
              >
                <Tabs defaultValue="account" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="account">Account</TabsTrigger>
                    <TabsTrigger value="password">Password</TabsTrigger>
                  </TabsList>
                  <TabsContent value="account" className="mt-4">
                    <p className="text-sm text-muted-foreground">
                      Make changes to your account here. Click save when you're done.
                    </p>
                  </TabsContent>
                  <TabsContent value="password" className="mt-4">
                    <p className="text-sm text-muted-foreground">
                      Change your password here. After saving, you'll be logged out.
                    </p>
                  </TabsContent>
                </Tabs>
              </ComponentDemo>

              <ComponentDemo
                title="Avatar"
                description="User avatar component"
                code={`<Avatar>
  <AvatarImage src="/avatars/01.png" alt="@user" />
  <AvatarFallback>JD</AvatarFallback>
</Avatar>`}
              >
                <div className="flex gap-4">
                  <Avatar>
                    <AvatarImage src="/avatars/01.png" alt="@user" />
                    <AvatarFallback>JD</AvatarFallback>
                  </Avatar>
                  <Avatar>
                    <AvatarFallback>AB</AvatarFallback>
                  </Avatar>
                  <Avatar>
                    <AvatarFallback>CD</AvatarFallback>
                  </Avatar>
                </div>
              </ComponentDemo>
            </div>
          </div>

          {/* Layout Components */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Layout Components</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <ComponentDemo
                title="Separator"
                description="Visual divider"
                code={`<div>Content above</div>
<Separator />
<div>Content below</div>`}
              >
                <div className="space-y-4">
                  <div>Content above</div>
                  <Separator />
                  <div>Content below</div>
                </div>
              </ComponentDemo>

              <ComponentDemo
                title="Search Field"
                description="Search input with icon"
                code={`<div className="relative">
  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
  <Input placeholder="Search..." className="pl-8" />
</div>`}
              >
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search..." className="pl-8" />
                </div>
              </ComponentDemo>

              <ComponentDemo
                title="Empty State"
                description="Empty state placeholder"
                code={`<div className="text-center py-8">
  <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
    <X className="h-6 w-6 text-muted-foreground" />
  </div>
  <h3 className="text-lg font-medium">No items found</h3>
  <p className="text-muted-foreground">Try adjusting your search criteria.</p>
</div>`}
              >
                <div className="text-center py-8">
                  <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
                    <X className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-medium">No items found</h3>
                  <p className="text-muted-foreground">Try adjusting your search criteria.</p>
                </div>
              </ComponentDemo>
            </div>
          </div>

          {/* Status Indicators */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Status Indicators</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <ComponentDemo
                title="Status Dots"
                description="Status indicators with colors"
                code={`<div className="flex items-center gap-2">
  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
  <span>Online</span>
</div>`}
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Online</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                    <span>Idle</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <span>Offline</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                    <span>Unknown</span>
                  </div>
                </div>
              </ComponentDemo>

              <ComponentDemo
                title="Success/Error States"
                description="Success and error indicators"
                code={`<div className="flex items-center gap-2">
  <CheckCircle className="h-4 w-4 text-green-500" />
  <span>Operation successful</span>
</div>`}
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Operation successful</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    <span>Operation failed</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-blue-500" />
                    <span>Information message</span>
                  </div>
                </div>
              </ComponentDemo>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
