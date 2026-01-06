"use client";

import { useState, useEffect, useId, useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { Search, MapPin, AlertCircle, LocateFixed, ExternalLink, Info } from "lucide-react";
import {
  formatAddressLines,
  reverseGeocodeAddress,
  searchAddress,
  type GeocodedAddress,
} from "@/lib/geocoding";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface AddressSearchProps {
  value?: string;
  onSelect: (address: GeocodedAddress) => void;
  placeholder?: string;
  className?: string;
  error?: string;
  enableCurrentLocation?: boolean;
}

type LocationPreference = "allow" | "deny" | "unknown";

const LOCATION_PREF_KEY = "otw-location-permission-pref-v1";

const getPlatformHint = (): "ios" | "android" | "other" => {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent || "";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  if (/android/i.test(ua)) return "android";
  return "other";
};

const readPreference = (): LocationPreference => {
  if (typeof window === "undefined") return "unknown";
  try {
    const raw = window.localStorage.getItem(LOCATION_PREF_KEY);
    if (!raw) return "unknown";
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return "unknown";
    const choice = (parsed as Record<string, unknown>).choice;
    return choice === "allow" || choice === "deny" ? choice : "unknown";
  } catch {
    return "unknown";
  }
};

const writePreference = (choice: Exclude<LocationPreference, "unknown">) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      LOCATION_PREF_KEY,
      JSON.stringify({ choice, updatedAt: new Date().toISOString() })
    );
  } catch {
    // ignore
  }
};

export function AddressSearch({
  value = "",
  onSelect,
  placeholder = "Enter delivery address...",
  className,
  error,
  enableCurrentLocation = false,
}: AddressSearchProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<GeocodedAddress[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [locationPref, setLocationPref] = useState<LocationPreference>("unknown");
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationBusy, setLocationBusy] = useState(false);
  const [learnMoreOpen, setLearnMoreOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const errorId = useId();
  const platformHint = getPlatformHint();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!enableCurrentLocation) return;
    setLocationPref(readPreference());
  }, [enableCurrentLocation]);

  // Search addresses with debounce
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (query.trim().length < 3) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const addresses = await searchAddress(query);
        setResults(addresses);
        setIsOpen(addresses.length > 0);
        setSelectedIndex(-1);
      } catch (error) {
        console.error("Address search failed:", error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 500);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query]);

  const handleSelect = (address: GeocodedAddress) => {
    setQuery(address.formattedAddress);
    setIsOpen(false);
    onSelect(address);
  };

  const requestCurrentLocation = async () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationError("Location services are not available in this browser.");
      return;
    }

    setLocationError(null);
    setLocationBusy(true);

    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        timeout: 12_000,
        maximumAge: 60_000,
      });
    }).catch((err: unknown) => {
      const geolocationError = err as Partial<GeolocationPositionError> | undefined;
      if (geolocationError?.code === 1) {
        writePreference("deny");
        setLocationPref("deny");
        setLocationError(
          "Location permission was denied. You can still enter your address manually."
        );
        return null;
      }
      setLocationError("Unable to access your location. Please enter your address manually.");
      return null;
    });

    if (!position) {
      setLocationBusy(false);
      return;
    }

    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    const resolved = await reverseGeocodeAddress(lat, lng);
    if (!resolved) {
      setLocationError(
        "We couldn't verify an address from this location (or it's outside our service area). Please enter your address manually."
      );
      setLocationBusy(false);
      return;
    }

    handleSelect(resolved);
    setLocationBusy(false);
    setLocationModalOpen(false);
    setLearnMoreOpen(false);
  };

  const openLocationModal = () => {
    setLocationError(null);
    setLearnMoreOpen(false);
    setLocationModalOpen(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < results.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          handleSelect(results[selectedIndex]);
        }
        break;
      case "Escape":
        setIsOpen(false);
        break;
    }
  };

  return (
    <div ref={wrapperRef} className={cn("relative w-full", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          placeholder={placeholder}
          className={cn(
            "w-full rounded-lg border border-border/70 bg-input py-2.5 pl-10 pr-10 text-sm text-foreground shadow-sm ring-offset-background transition-colors duration-300",
            "placeholder:text-muted-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/80 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            "disabled:cursor-not-allowed disabled:opacity-50",
            enableCurrentLocation && "pr-20",
            error && "border-red-500"
          )}
        />
        {enableCurrentLocation && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={openLocationModal}
              aria-label="Use current location"
              className="h-9 w-9"
            >
              <LocateFixed className="h-4 w-4" />
            </Button>
          </div>
        )}
        {isLoading && (
          <div
            className={cn(
              "absolute top-1/2 -translate-y-1/2",
              enableCurrentLocation ? "right-12" : "right-3"
            )}
          >
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-secondary border-t-transparent motion-reduce:animate-none" />
          </div>
        )}
      </div>

      {enableCurrentLocation && locationPref === "deny" && (
        <div className="mt-2 flex items-start gap-2 rounded-lg border border-border/70 bg-muted/40 p-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
          <div>
            Location access is off. Enter your address manually, or use “Use current location” to review options.
          </div>
        </div>
      )}

      <Dialog.Root
        open={locationModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setLocationBusy(false);
            setLearnMoreOpen(false);
          }
          setLocationModalOpen(open);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border/70 bg-card/95 p-6 text-foreground shadow-otwElevated backdrop-blur-xl focus:outline-none">
            <Dialog.Title className="text-base font-semibold text-foreground">
              Use your current location?
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-muted-foreground">
              We use your location to suggest and verify an address (service-area check) and to improve delivery accuracy.
            </Dialog.Description>

            <div className="mt-4 space-y-3 text-sm text-muted-foreground">
              <div className="rounded-xl border border-border/70 bg-muted/40 p-3">
                <div className="font-medium text-foreground">What happens if you allow</div>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>We request your device location only after you tap Allow.</li>
                  <li>We convert it to an address on-device and show it for confirmation.</li>
                  <li>We don’t use location for ads, and you can still type an address manually.</li>
                </ul>
              </div>

              <button
                type="button"
                className="inline-flex items-center gap-2 text-sm text-secondary hover:underline"
                onClick={() => setLearnMoreOpen((prev) => !prev)}
                aria-expanded={learnMoreOpen}
              >
                <span>Learn More</span>
                <ExternalLink className="h-4 w-4" />
              </button>

              {learnMoreOpen && (
                <div className="rounded-xl border border-border/70 bg-muted/40 p-3 text-xs text-muted-foreground">
                  <div className="font-medium text-foreground">Privacy details</div>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    <li>Consent-based: you control whether location is used.</li>
                    <li>Data minimization: we use a one-time lookup to suggest an address.</li>
                    <li>Retention: location is not stored unless it’s submitted as part of your request.</li>
                    <li>Control: you can revoke access anytime in your browser/device settings.</li>
                  </ul>
                  <div className="mt-3">
                    <Link href="/privacy" className="text-secondary hover:underline">
                      View Privacy Policy
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {locationError && (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <div>{locationError}</div>
              </div>
            )}

            <div
              className={cn(
                "mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
                platformHint === "ios" && "sm:flex-row"
              )}
            >
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  writePreference("deny");
                  setLocationPref("deny");
                  setLocationModalOpen(false);
                  setLearnMoreOpen(false);
                }}
                disabled={locationBusy}
                className="border-border/70"
              >
                {platformHint === "ios" ? "Don’t Allow" : "Deny"}
              </Button>
              <Button
                type="button"
                onClick={async () => {
                  writePreference("allow");
                  setLocationPref("allow");
                  await requestCurrentLocation();
                }}
                disabled={locationBusy}
              >
                {locationBusy ? "Allowing…" : "Allow"}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {error && (
        <div
          id={errorId}
          className="mt-1 flex items-center gap-1 text-sm text-red-400"
          role="alert"
        >
          <AlertCircle className="h-3 w-3" />
          <span>{error}</span>
        </div>
      )}

      {isOpen && results.length > 0 && (
        <div className="absolute z-50 mt-1 max-h-[300px] w-full overflow-auto rounded-xl border border-border/70 bg-card/95 shadow-otwElevated backdrop-blur">
          {results.map((address, index) => {
            const lines = formatAddressLines(address);
            return (
            <button
              key={index}
              type="button"
              onClick={() => handleSelect(address)}
              className={cn(
                "flex w-full items-start gap-3 px-4 py-3 text-left text-sm text-foreground transition-colors duration-300",
                "hover:bg-muted/50",
                selectedIndex === index && "bg-muted/60"
              )}
            >
              <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-secondary/80" />
              <div className="flex-1 space-y-1">
                <div className="font-medium">{lines.primary}</div>
                {lines.secondary && (
                  <div className="text-xs text-muted-foreground">{lines.secondary}</div>
                )}
                <div className="text-xs text-emerald-300">
                  ✓ {address.distanceFromFortWayne} miles from Fort Wayne
                </div>
              </div>
            </button>
            );
          })}
        </div>
      )}

      {isOpen && !isLoading && query.trim().length >= 3 && results.length === 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-border/70 bg-card/95 p-4 text-center text-sm text-muted-foreground shadow-otwElevated backdrop-blur">
          <AlertCircle className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
          <p>No addresses found within 25 miles of Fort Wayne.</p>
          <p className="mt-1 text-xs">Please try a different address.</p>
        </div>
      )}
    </div>
  );
}
