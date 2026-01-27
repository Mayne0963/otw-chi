"use client";

import OtwPageShell from "@/components/ui/otw/OtwPageShell";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

export default function DesignSystemPage() {
  return (
    <OtwPageShell header={<h1 className="text-4xl font-bold font-display">Design System</h1>}>
      <div className="space-y-12">
        {/* Colors Section */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold font-display">Colors</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <ColorSwatch name="Primary (Red)" color="bg-primary" text="text-primary-foreground" hex="#B00017" />
            <ColorSwatch name="Secondary (Gold)" color="bg-secondary" text="text-secondary-foreground" hex="#E6C36A" />
            <ColorSwatch name="Background" color="bg-background" text="text-foreground" border hex="#0C0C0C" />
            <ColorSwatch name="Surface / Card" color="bg-card" text="text-card-foreground" border hex="#121212" />
            <ColorSwatch name="Muted" color="bg-muted" text="text-muted-foreground" hex="#242424" />
            <ColorSwatch name="Destructive" color="bg-destructive" text="text-destructive-foreground" hex="#DC2626" />
            <ColorSwatch name="Accent" color="bg-accent" text="text-accent-foreground" hex="#E6C36A" />
            <ColorSwatch name="Input" color="bg-input" text="text-foreground" border hex="#1F1F1F" />
          </div>
        </section>

        <Separator className="my-8" />

        {/* Typography Section */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold font-display">Typography</h2>
          <div className="space-y-4 p-6 border rounded-xl bg-card">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Display / H1</span>
              <h1>The quick brown fox jumps over the lazy dog</h1>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Heading / H2</span>
              <h2>The quick brown fox jumps over the lazy dog</h2>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Heading / H3</span>
              <h3>The quick brown fox jumps over the lazy dog</h3>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Heading / H4</span>
              <h4>The quick brown fox jumps over the lazy dog</h4>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Body / P</span>
              <p>
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. 
                Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Small</span>
              <p className="text-sm text-muted-foreground">
                Small text for captions, hints, or secondary information.
              </p>
            </div>
          </div>
        </section>

        <Separator className="my-8" />

        {/* Buttons Section */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold font-display">Buttons</h2>
          <div className="flex flex-wrap gap-4 p-6 border rounded-xl bg-card">
            <Button variant="default">Default</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="link">Link</Button>
            <Button variant="gold">Gold (Brand)</Button>
            <Button variant="red">Red (Brand)</Button>
          </div>
          <div className="flex flex-wrap gap-4 p-6 border rounded-xl bg-card">
            <Button size="lg">Large</Button>
            <Button size="default">Default</Button>
            <Button size="sm">Small</Button>
            <Button size="icon">Icon</Button>
            <Button isLoading>Loading</Button>
          </div>
        </section>

        <Separator className="my-8" />

        {/* Inputs Section */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold font-display">Form Elements</h2>
          <div className="grid md:grid-cols-2 gap-8 p-6 border rounded-xl bg-card">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Email Address</label>
                <Input placeholder="name@example.com" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Disabled Input</label>
                <Input disabled placeholder="Cannot type here" />
              </div>
            </div>
            <div className="space-y-4">
               <div className="space-y-2">
                <label className="text-sm font-medium text-destructive">Error State</label>
                <Input aria-invalid="true" placeholder="Invalid value" />
                <p className="text-xs text-destructive">Please enter a valid email.</p>
              </div>
            </div>
          </div>
        </section>

        <Separator className="my-8" />

        {/* Cards Section */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold font-display">Cards & Surfaces</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Standard Card</CardTitle>
                <CardDescription>This is a standard card component used for grouping content.</CardDescription>
              </CardHeader>
              <CardContent>
                <p>Card content goes here. It uses the <code>bg-card</code> token.</p>
              </CardContent>
              <CardFooter>
                <Button variant="outline" size="sm">Action</Button>
              </CardFooter>
            </Card>

             <div className="otw-surface p-6 space-y-4">
                <h3 className="text-xl font-semibold font-display">OTW Surface</h3>
                <p className="text-sm text-muted-foreground">
                    This uses the <code>.otw-surface</code> utility class for a slightly different background and border treatment.
                </p>
                <Button variant="secondary" size="sm">Secondary Action</Button>
            </div>
          </div>
        </section>
      </div>
    </OtwPageShell>
  );
}

function ColorSwatch({ name, color, text, hex, border }: { name: string; color: string; text: string; hex: string; border?: boolean }) {
  return (
    <div className={`p-4 rounded-xl space-y-3 ${color} ${border ? 'border border-border' : ''}`}>
      <div className={`h-12 w-full rounded-lg bg-black/10`}></div>
      <div>
        <p className={`font-semibold ${text}`}>{name}</p>
        <p className={`text-xs opacity-80 ${text}`}>{hex}</p>
      </div>
    </div>
  );
}
