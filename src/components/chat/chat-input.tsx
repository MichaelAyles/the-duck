"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import { FileUploadComponent } from "./file-upload";
import { FilePreview } from "./file-preview";
import { ExcalidrawInput } from "./excalidraw-input";
import type { FileUpload } from "@/types/file-upload";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { logger } from "@/lib/logger";

interface ChatInputProps {
  onSendMessage: (message: string, attachments?: FileUpload[]) => void;
  disabled?: boolean;
  storageEnabled: boolean;
  sessionId?: string;
  userId?: string;
}

export function ChatInput({ onSendMessage, disabled = false, storageEnabled, sessionId, userId }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<FileUpload[]>([]);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if ((message.trim() || attachments.length > 0) && !disabled) {
      logger.dev.log(`🎯 [${new Date().toISOString()}] ChatInput sending message:`, message, 'with', attachments.length, 'attachments');
      onSendMessage(message, attachments.length > 0 ? attachments : undefined);
      setMessage("");
      setAttachments([]);
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  };

  const handleFileUploaded = (file: FileUpload, url: string) => {
    setAttachments([...attachments, { ...file, url } as FileUpload & { url: string }]);
    setShowFileUpload(false);
  };

  const handleRemoveAttachment = (fileId: string) => {
    setAttachments(attachments.filter(a => a.id !== fileId));
  };

  const handleDrawingCreate = async (imageData: Blob, metadata: { 
    name: string; 
    elements: unknown[]; 
    mimeType: string;
  }) => {
    try {
      // Create a complete file upload object for the drawing
      const drawingFile: FileUpload & { url: string } = {
        id: crypto.randomUUID(),
        file_name: metadata.name,
        file_type: 'image',
        file_size: imageData.size,
        mime_type: metadata.mimeType,
        storage_path: '', // Will be set by upload process
        user_id: userId || '',
        session_id: sessionId || '',
        created_at: new Date().toISOString(),
        url: URL.createObjectURL(imageData), // Temporary URL for preview
      };

      // Add to attachments immediately
      setAttachments([...attachments, drawingFile]);

      logger.dev.log('🎨 Drawing created:', metadata.name, 'Size:', imageData.size);
    } catch (error) {
      console.error('Error handling drawing creation:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [message]);

  return (
    <div className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 duck-shadow">
      <div className="w-full flex justify-center p-4">
        <div className="max-w-4xl w-full">
        {/* Show attached files */}
        {attachments.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {attachments.map((attachment) => (
              <FilePreview
                key={attachment.id}
                file={attachment}
                url={(attachment as FileUpload & { url?: string }).url}
                compact
                onDelete={handleRemoveAttachment}
              />
            ))}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="flex gap-3">
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                storageEnabled
                  ? "Tell me what you're curious about... (Learning from our chat)"
                  : "What's on your mind? (Private mode - no data saved)"
              }
              disabled={disabled}
              className={cn(
                "min-h-[60px] max-h-[200px] resize-none pr-20 transition-all duration-300 duck-shadow focus:duck-glow",
                !storageEnabled && "bg-muted/50 border-muted"
              )}
              rows={1}
            />
            
            <div className="absolute bottom-2 right-2 flex items-center gap-1 z-10">
              <ExcalidrawInput
                onDrawingCreate={handleDrawingCreate}
                onFileUploaded={handleFileUploaded}
                userId={userId}
                disabled={disabled || !userId}
              />
              
              <Popover open={showFileUpload} onOpenChange={setShowFileUpload}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 hover:duck-glow transition-all duration-300"
                    disabled={disabled || !userId}
                    title={!userId ? "Sign in to upload files" : "Attach file"}
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 z-50" align="end">
                  <FileUploadComponent
                    sessionId={sessionId}
                    userId={userId}
                    onFileUploaded={handleFileUploaded}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          
          <Button
            type="submit"
            disabled={disabled || (!message.trim() && attachments.length === 0)}
            className="self-end h-[60px] px-6 duck-gradient hover:duck-glow transition-all duration-300 font-semibold"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
        
        <div className="mt-3 text-xs text-center">
          {storageEnabled ? (
            <span className="text-primary font-medium flex items-center justify-center gap-1">
              🧠 Learning from our conversations to better assist you
            </span>
          ) : (
            <span className="text-accent font-medium flex items-center justify-center gap-1">
              🔒 Private mode - Conversation not stored
            </span>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}