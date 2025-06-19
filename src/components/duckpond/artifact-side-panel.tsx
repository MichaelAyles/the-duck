"use client";

import React from 'react';
import { X, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useArtifactPanel } from '@/contexts/artifact-panel-context';
import { DuckPondViewer } from './duckpond-viewer';
import { cn } from '@/lib/utils';

interface ArtifactSidePanelProps {
  className?: string;
}

export function ArtifactSidePanel({ className }: ArtifactSidePanelProps) {
  const { isOpen, activeArtifact, closePanel } = useArtifactPanel();
  const [isExpanded, setIsExpanded] = React.useState(false);

  if (!isOpen || !activeArtifact) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed right-0 top-0 h-full bg-background border-l border-border shadow-lg transition-all duration-300 z-50",
        isExpanded ? "w-[60%]" : "w-[40%]",
        className
      )}
    >
      <Card className="h-full rounded-none border-none">
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <CardTitle className="text-lg truncate">{activeArtifact.title}</CardTitle>
              <Badge variant="secondary" className="text-xs flex-shrink-0">
                {activeArtifact.type}
              </Badge>
            </div>
            
            <div className="flex items-center gap-1 flex-shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="h-8 w-8 p-0"
              >
                {isExpanded ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={closePanel}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {activeArtifact.description && (
            <p className="text-sm text-muted-foreground mt-1">
              {activeArtifact.description}
            </p>
          )}
        </CardHeader>

        <CardContent className="p-0 h-[calc(100%-theme(spacing.20))] overflow-hidden">
          <DuckPondViewer
            artifact={activeArtifact}
            className="h-full border-none rounded-none"
            initialTab="preview"
            enableFullscreen={false}
            hideHeader={true}
          />
        </CardContent>
      </Card>
    </div>
  );
}