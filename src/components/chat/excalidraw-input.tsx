"use client";

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Pencil, X, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { FileUploadService } from '@/lib/file-upload-service';
import type { FileUpload } from '@/types/file-upload';

// Import Excalidraw styles
import '@excalidraw/excalidraw/index.css';
import { logger } from '@/lib/logger';

// Configure Excalidraw to use local fonts
if (typeof window !== 'undefined') {
  (window as unknown as { EXCALIDRAW_ASSET_PATH: string }).EXCALIDRAW_ASSET_PATH = '/';
}

// Types will be imported from Excalidraw at runtime - using unknown for type safety
type ExcalidrawElement = unknown;
type ExcalidrawAPI = {
  getSceneElements: () => unknown[];
  getFiles: () => unknown;
};

interface ExcalidrawInputProps {
  onDrawingCreate: (imageData: Blob, metadata: { 
    name: string; 
    elements: ExcalidrawElement[]; 
    mimeType: string;
  }) => void;
  onFileUploaded?: (file: FileUpload, url: string) => void;
  userId?: string;
  disabled?: boolean;
}

export function ExcalidrawInput({ onDrawingCreate, onFileUploaded, userId, disabled }: ExcalidrawInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [ExcalidrawComponent, setExcalidrawComponent] = useState<React.ComponentType<Record<string, unknown>> | null>(null);
  const [exportToCanvas, setExportToCanvas] = useState<((opts: unknown) => Promise<HTMLCanvasElement>) | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [elements, setElements] = useState<ExcalidrawElement[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const excalidrawAPIRef = useRef<ExcalidrawAPI | null>(null);
  const fileUploadService = useRef(new FileUploadService());
  const { toast } = useToast();

  // Dynamically import Excalidraw when dialog opens
  useEffect(() => {
    if (isOpen && (!ExcalidrawComponent || !exportToCanvas)) {
      setIsLoading(true);
      import('@excalidraw/excalidraw')
        .then((module) => {
          logger.dev.log('Excalidraw module loaded:', module);
          setExcalidrawComponent(module.Excalidraw);
          setExportToCanvas(() => module.exportToCanvas);
          setIsLoading(false);
        })
        .catch((error) => {
          logger.error('Failed to load Excalidraw:', error);
          toast({
            title: "Error",
            description: "Failed to load drawing component. Please try again.",
            variant: "destructive",
          });
          setIsLoading(false);
          setIsOpen(false);
        });
    }
  }, [isOpen, ExcalidrawComponent, exportToCanvas, toast]);

  const handleExcalidrawChange = useCallback((
    elements: unknown[]
  ) => {
    setElements(elements);
    setHasChanges(elements.length > 0);
  }, []);

  const handleExcalidrawAPI = useCallback((api: ExcalidrawAPI) => {
    excalidrawAPIRef.current = api;
  }, []);

  const exportDrawing = useCallback(async () => {
    if (!excalidrawAPIRef.current || !exportToCanvas || !userId) {
      toast({
        title: "Export unavailable",
        description: "Drawing component not ready or user not signed in.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Get current elements from the API
      const currentElements = excalidrawAPIRef.current.getSceneElements();
      
      // Check if there are actually elements to export
      if (!currentElements || currentElements.length === 0) {
        toast({
          title: "Nothing to export",
          description: "Please create a drawing first.",
          variant: "destructive",
        });
        return;
      }

      // Show uploading state
      toast({
        title: "Uploading drawing...",
        description: "Please wait while we save your drawing.",
      });
      
      // Export to canvas using the proper API
      const canvas = await exportToCanvas({
        elements: currentElements,
        files: excalidrawAPIRef.current.getFiles(),
        getDimensions: () => ({ width: 800, height: 600 }), // Set reasonable dimensions
      });

      // Convert canvas to blob and then to File
      return new Promise<void>((resolve) => {
        canvas.toBlob(async (blob: Blob | null) => {
          if (blob) {
            try {
              const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
              const fileName = `drawing-${timestamp}.png`;
              
              // Convert blob to File object for upload
              const file = new File([blob], fileName, { type: 'image/png' });
              
              // Upload to Supabase storage
              const uploadResult = await fileUploadService.current.uploadFile(file, userId);
              
              if (uploadResult.success && uploadResult.fileUpload && uploadResult.url) {
                // Use the onFileUploaded callback if provided, otherwise fall back to onDrawingCreate
                if (onFileUploaded) {
                  onFileUploaded(uploadResult.fileUpload, uploadResult.url);
                } else {
                  const metadata = {
                    name: fileName,
                    elements: currentElements,
                    mimeType: 'image/png' as const,
                  };
                  onDrawingCreate(blob, metadata);
                }
                
                setIsOpen(false);
                setElements([]);
                setHasChanges(false);
                
                toast({
                  title: "Drawing uploaded",
                  description: "Your drawing has been saved and attached to the message.",
                });
              } else {
                throw new Error(uploadResult.error || 'Upload failed');
              }
            } catch (uploadError) {
              logger.error('Error uploading drawing:', uploadError);
              toast({
                title: "Upload failed",
                description: "Failed to upload your drawing. Please try again.",
                variant: "destructive",
              });
            }
          }
          resolve();
        }, 'image/png', 0.9);
      });
    } catch (error) {
      logger.error('Error exporting drawing:', error);
      toast({
        title: "Export failed",
        description: "Failed to export your drawing. Please try again.",
        variant: "destructive",
      });
    }
  }, [exportToCanvas, onDrawingCreate, onFileUploaded, userId, toast]);

  const handleClose = useCallback(() => {
    if (hasChanges) {
      const shouldClose = window.confirm(
        "You have unsaved changes. Are you sure you want to close without saving?"
      );
      if (!shouldClose) return;
    }
    
    setIsOpen(false);
    setElements([]);
    setHasChanges(false);
  }, [hasChanges]);

  const clearDrawing = useCallback(() => {
    if (elements.length > 0) {
      const shouldClear = window.confirm(
        "Are you sure you want to clear your drawing?"
      );
      if (shouldClear) {
        setElements([]);
        setHasChanges(false);
      }
    }
  }, [elements.length]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          className="h-8 w-8 p-0"
          title="Create drawing"
        >
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-[90vw] w-[1200px] h-[85vh] flex flex-col p-0" hideClose>
        <DialogHeader className="flex-shrink-0 p-6 pb-4">
          <DialogTitle className="flex items-center justify-between">
            <span>Create Drawing</span>
            <div className="flex items-center gap-2">
              {hasChanges && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearDrawing}
                  className="text-destructive hover:text-destructive"
                >
                  Clear
                </Button>
              )}
              <Button
                variant="default"
                size="sm"
                onClick={exportDrawing}
                disabled={!hasChanges || !excalidrawAPIRef.current || !userId}
                className="gap-2"
              >
                <Check className="h-4 w-4" />
                Add to Message
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClose}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 relative overflow-hidden" style={{ minHeight: '400px' }}>
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                <p className="text-sm text-muted-foreground">Loading drawing canvas...</p>
              </div>
            </div>
          ) : ExcalidrawComponent ? (
            <div className="absolute inset-0 bg-white" style={{ width: '100%', height: '100%' }}>
              <ExcalidrawComponent
                onChange={(elements: unknown[]) => handleExcalidrawChange(elements)}
                excalidrawAPI={handleExcalidrawAPI}
                renderTopRightUI={() => null}
                UIOptions={{
                  canvasActions: {
                    loadScene: false,
                    saveToActiveFile: false,
                    toggleTheme: false,
                  },
                }}
              />
            </div>
          ) : null}
        </div>
        
        <div className="flex-shrink-0 text-xs text-muted-foreground text-center p-4">
          Use the drawing tools above to create diagrams, sketches, or visual content for your AI conversation.
        </div>
      </DialogContent>
    </Dialog>
  );
}