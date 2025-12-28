"use client";

import { useState, useEffect, useRef } from "react";
import { Search, MapPin, AlertCircle } from "lucide-react";
import { searchAddress, type GeocodedAddress } from "@/lib/geocoding";
import { cn } from "@/lib/utils";

interface AddressSearchProps {
  value?: string;
  onSelect: (address: GeocodedAddress) => void;
  placeholder?: string;
  className?: string;
  error?: string;
}

export function AddressSearch({
  value = "",
  onSelect,
  placeholder = "Enter delivery address...",
  className,
  error,
}: AddressSearchProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<GeocodedAddress[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

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
          placeholder={placeholder}
          className={cn(
            "w-full rounded-md border border-input bg-background px-10 py-2 text-sm ring-offset-background",
            "placeholder:text-muted-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-red-500"
          )}
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}
      </div>

      {error && (
        <div className="mt-1 flex items-center gap-1 text-sm text-red-500">
          <AlertCircle className="h-3 w-3" />
          <span>{error}</span>
        </div>
      )}

      {isOpen && results.length > 0 && (
        <div className="absolute z-50 mt-1 max-h-[300px] w-full overflow-auto rounded-md border bg-popover shadow-md">
          {results.map((address, index) => (
            <button
              key={index}
              type="button"
              onClick={() => handleSelect(address)}
              className={cn(
                "flex w-full items-start gap-3 px-4 py-3 text-left text-sm transition-colors",
                "hover:bg-accent hover:text-accent-foreground",
                selectedIndex === index && "bg-accent text-accent-foreground"
              )}
            >
              <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
              <div className="flex-1 space-y-1">
                <div className="font-medium">{address.streetAddress}</div>
                <div className="text-xs text-muted-foreground">
                  {address.city}, {address.state} {address.zipCode}
                </div>
                <div className="text-xs text-green-600">
                  ✓ {address.distanceFromFortWayne} miles from Fort Wayne
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {isOpen && !isLoading && query.trim().length >= 3 && results.length === 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover p-4 text-center text-sm text-muted-foreground shadow-md">
          <AlertCircle className="mx-auto mb-2 h-5 w-5" />
          <p>No addresses found within 25 miles of Fort Wayne.</p>
          <p className="mt-1 text-xs">Please try a different address.</p>
        </div>
      )}
    </div>
  );
}
