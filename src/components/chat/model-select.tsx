"use client";

import React from "react";
import { Select, SelectContent, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface ModelSelectProps {
  value: string;
  onChange: (value: string) => void;
  onOpenChange?: (open: boolean) => void;
  modelOptions: React.ReactNode;
  currentModelName: string;
  triggerClassName?: string;
  contentClassName?: string;
}

export const ModelSelect = React.memo(function ModelSelect({
  value,
  onChange,
  onOpenChange,
  modelOptions,
  currentModelName,
  triggerClassName,
  contentClassName,
}: ModelSelectProps) {
  return (
    <Select value={value} onValueChange={onChange} onOpenChange={onOpenChange}>
      <SelectTrigger className={cn("truncate", triggerClassName)}>
        <SelectValue className="truncate font-medium">
          {currentModelName}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className={cn("w-80", contentClassName)}>
        {modelOptions}
      </SelectContent>
    </Select>
  );
});