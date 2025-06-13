"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
  storageEnabled: boolean;
}

export function ChatInput({ onSendMessage, disabled = false, storageEnabled }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSendMessage(message);
      setMessage("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
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
        <form onSubmit={handleSubmit} className="flex gap-3">
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                storageEnabled
                  ? "🦆 Quack away! Tell me what's on your mind... (Learning from our chat)"
                  : "🦆 What's on your mind? (Private mode - no data saved)"
              }
              disabled={disabled}
              className={cn(
                "min-h-[60px] max-h-[200px] resize-none pr-12 transition-all duration-300 duck-shadow focus:duck-glow",
                !storageEnabled && "bg-muted/50 border-muted"
              )}
              rows={1}
            />
            
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute bottom-2 right-2 h-8 w-8 p-0 hover:duck-glow transition-all duration-300"
              disabled={disabled}
            >
              <Paperclip className="h-4 w-4" />
            </Button>
          </div>
          
          <Button
            type="submit"
            disabled={disabled || !message.trim()}
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