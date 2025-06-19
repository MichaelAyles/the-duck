"use client";

import React, { useState, useCallback } from 'react';
import { X, Maximize2, Minimize2, Play, Square, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useArtifactPanel } from '@/contexts/artifact-panel-context';
import { DuckPondViewer } from './duckpond-viewer';
import { cn } from '@/lib/utils';
import { ArtifactExecution } from '@/types/artifact';

interface ArtifactSidePanelProps {
  className?: string;
}

export function ArtifactSidePanel({ className }: ArtifactSidePanelProps) {
  const { isOpen, activeArtifact, closePanel } = useArtifactPanel();
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [execution, setExecution] = useState<ArtifactExecution>({
    artifactId: activeArtifact?.id || '',
    status: 'idle',
  });

  // Update execution artifact ID when active artifact changes
  React.useEffect(() => {
    if (activeArtifact) {
      setExecution(prev => ({
        ...prev,
        artifactId: activeArtifact.id,
        status: 'idle',
        error: undefined,
      }));
    }
  }, [activeArtifact]);

  const handleExecute = useCallback(() => {
    if (execution.status === 'executing') return;
    setExecution(prev => ({ ...prev, status: 'executing', error: undefined }));
    // The DuckPondViewer will handle the actual execution
  }, [execution.status]);

  const handleStop = useCallback(() => {
    setExecution(prev => ({ ...prev, status: 'stopped' }));
  }, []);

  const handleReset = useCallback(() => {
    setExecution(prev => ({
      ...prev,
      status: 'idle',
      error: undefined,
      lastExecuted: undefined,
    }));
  }, []);

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
              {/* Run/Stop/Reset Controls */}
              <div className="flex items-center bg-muted rounded-md mr-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={execution.status === 'executing' ? handleStop : handleExecute}
                  className="rounded-r-none px-3"
                >
                  {execution.status === 'executing' ? (
                    <Square className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  <span className="ml-1 text-xs">
                    {execution.status === 'executing' ? 'Stop' : 'Run'}
                  </span>
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleReset}
                  disabled={execution.status === 'executing'}
                  className="rounded-l-none border-l px-2"
                  title="Reset to initial state"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>

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
            externalExecution={execution}
            onExecutionChange={setExecution}
          />
        </CardContent>
      </Card>
    </div>
  );
}