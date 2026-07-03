import React from 'react';
import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function DashboardDesignSystemPage() {
  return (
    <OtwPageShell>
      <OtwSectionHeader title="Design System" subtitle="Core components and tokens." />
      
      {/* Colors */}
      <section className="mt-8 space-y-4">
        <h3 className="text-lg font-semibold">Colors</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <ColorSwatch name="Primary (Red)" className="bg-primary text-primary-foreground" />
          <ColorSwatch name="Secondary (Gold)" className="bg-secondary text-secondary-foreground" />
          <ColorSwatch name="Background" className="bg-background text-foreground border border-border" />
          <ColorSwatch name="Card" className="bg-card text-card-foreground border border-border" />
          <ColorSwatch name="Muted" className="bg-muted text-muted-foreground" />
          <ColorSwatch name="Accent" className="bg-accent text-accent-foreground" />
          <ColorSwatch name="Destructive" className="bg-destructive text-destructive-foreground" />
          <ColorSwatch name="Border" className="bg-border text-foreground" />
        </div>
      </section>

      {/* Typography */}
      <section className="mt-12 space-y-4">
        <h3 className="text-lg font-semibold">Typography</h3>
        <Card className="p-6 space-y-4">
          <div>
            <div className="text-xs text-muted-foreground mb-1">Display Font</div>
            <h1 className="text-4xl font-bold font-display">The quick brown fox jumps over the lazy dog</h1>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Sans Font</div>
            <p className="text-base font-sans">The quick brown fox jumps over the lazy dog</p>
          </div>
        </Card>
      </section>

      {/* Buttons */}
      <section className="mt-12 space-y-4">
        <h3 className="text-lg font-semibold">Buttons</h3>
        <Card className="p-6">
          <div className="flex flex-wrap gap-4 items-center">
            <Button variant="default">Default</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="link">Link</Button>
            <Button variant="red">Red (OTW)</Button>
            <Button variant="gold">Gold (OTW)</Button>
          </div>
          <div className="mt-4 flex flex-wrap gap-4 items-center">
            <Button size="sm">Small</Button>
            <Button size="default">Default</Button>
            <Button size="lg">Large</Button>
            <Button size="icon">Icon</Button>
          </div>
        </Card>
      </section>

      {/* Cards */}
      <section className="mt-12 space-y-4">
        <h3 className="text-lg font-semibold">Cards</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="p-6">
            <h4 className="font-semibold mb-2">Default Card</h4>
            <p className="text-sm text-muted-foreground">Standard card with default styling.</p>
          </Card>
          <Card variant="red" className="p-6">
            <h4 className="font-semibold mb-2">Red Card</h4>
            <p className="text-sm opacity-90">Card with red styling.</p>
          </Card>
          <Card variant="gold" className="p-6">
            <h4 className="font-semibold mb-2">Gold Card</h4>
            <p className="text-sm opacity-90">Card with gold styling.</p>
          </Card>
          <Card variant="ghost" className="p-6">
            <h4 className="font-semibold mb-2">Ghost Card</h4>
            <p className="text-sm text-muted-foreground">Card with ghost styling (transparent).</p>
          </Card>
        </div>
      </section>

      {/* Inputs */}
      <section className="mt-12 space-y-4">
        <h3 className="text-lg font-semibold">Inputs</h3>
        <Card className="p-6 space-y-4 max-w-md">
          <div className="space-y-2">
            <label className="text-sm font-medium">Email Address</label>
            <Input placeholder="name@example.com" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Password</label>
            <Input type="password" placeholder="••••••••" />
          </div>
        </Card>
      </section>

    </OtwPageShell>
  );
}

function ColorSwatch({ name, className }: { name: string; className: string }) {
  return (
    <div className={`h-24 rounded-lg flex items-end p-3 ${className}`}>
      <span className="text-xs font-medium">{name}</span>
    </div>
  );
}
