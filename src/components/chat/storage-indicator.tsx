"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Loader2, Database, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface StorageIndicatorProps {
  isVisible: boolean;
  message?: string;
}

export function StorageIndicator({ isVisible, message = "Processing..." }: StorageIndicatorProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setIsAnimating(true);
      setShowSuccess(false);
    } else if (isAnimating) {
      // Show success state briefly before hiding
      setShowSuccess(true);
      const timer = setTimeout(() => {
        setIsAnimating(false);
        setShowSuccess(false);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isVisible, isAnimating]);

  if (!isAnimating) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="flex items-center gap-2 rounded-lg bg-background/95 p-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">{message}</span>
      </div>
    </div>
  );
}