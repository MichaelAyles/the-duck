"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Loader2, Database, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface StorageIndicatorProps {
  isVisible: boolean;
  message: string;
}

export function StorageIndicator({ isVisible, message }: StorageIndicatorProps) {
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
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50">
      <Card
        className={cn(
          "px-4 py-3 shadow-lg border-2 transition-all duration-300",
          showSuccess
            ? "border-green-500 bg-green-50 dark:bg-green-950"
            : "border-blue-500 bg-blue-50 dark:bg-blue-950"
        )}
      >
        <div className="flex items-center gap-3">
          {showSuccess ? (
            <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
          ) : (
            <>
              <Loader2 className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-400" />
              <Database className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </>
          )}
          
          <span className="text-sm font-medium">
            {showSuccess ? "Chat processed and stored successfully!" : message}
          </span>
        </div>
      </Card>
    </div>
  );
}