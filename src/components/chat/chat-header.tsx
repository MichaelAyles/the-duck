"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Settings, MessageSquare, Moon, Sun, Monitor, Loader2 } from "lucide-react";
import { useTheme } from "next-themes";
import { ChatSettings } from "./chat-interface";
import { useModels } from "@/hooks/use-models";
import { DuckLogo } from "@/components/duck-logo";
import { UserMenu } from "@/components/auth/user-menu";

interface ChatHeaderProps {
  settings: ChatSettings;
  onSettingsChange: (settings: Partial<ChatSettings>) => void;
  onEndChat: () => void;
  messageCount: number;
}

const TONE_OPTIONS = [
  { value: "match-user", label: "Match User's Style", description: "Adapts to your communication style" },
  { value: "professional", label: "Professional", description: "Formal and business-like" },
  { value: "casual", label: "Casual", description: "Friendly and relaxed" },
  { value: "concise", label: "Concise", description: "Brief and to the point" },
  { value: "detailed", label: "Detailed", description: "Comprehensive explanations" },
  { value: "duck", label: "🦆 Duck Mode", description: "Quack quack quack quack quack!" },
];

export function ChatHeader({ settings, onSettingsChange, onEndChat, messageCount }: ChatHeaderProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const { curatedModels, isLoading } = useModels();

  const handleToneChange = (value: number[]) => {
    const toneValue = TONE_OPTIONS[value[0]]?.value || "match-user";
    onSettingsChange({ tone: toneValue });
  };

  const getToneIndex = () => {
    return TONE_OPTIONS.findIndex(option => option.value === settings.tone);
  };

  const getCurrentToneLabel = () => {
    return TONE_OPTIONS.find(option => option.value === settings.tone)?.label || "Match User's Style";
  };

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 duck-shadow">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <DuckLogo variant="full" size="lg" className="transition-all duration-300 hover:scale-110" />
          </div>
          
          <div className="hidden md:flex items-center gap-2">
            <Select value={settings.model} onValueChange={(value) => onSettingsChange({ model: value })}>
              <SelectTrigger className="w-48 duck-shadow hover:duck-glow transition-all duration-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {isLoading ? (
                  <SelectItem value="loading" disabled>
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span>Loading models...</span>
                    </div>
                  </SelectItem>
                ) : (
                  curatedModels.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      <div className="flex flex-col">
                        <span className="font-medium">{model.name}</span>
                        <span className="text-xs text-muted-foreground">{model.provider}</span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-3 bg-secondary/50 rounded-lg px-3 py-1.5">
            <Label htmlFor="storage-toggle" className="text-sm font-medium">
              Storage
            </Label>
            <Switch
              id="storage-toggle"
              checked={settings.storageEnabled}
              onCheckedChange={(checked) => onSettingsChange({ storageEnabled: checked })}
            />
          </div>

          {messageCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={onEndChat}
              className="hidden sm:flex duck-shadow hover:duck-glow transition-all duration-300"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              End Chat
            </Button>
          )}

          <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="duck-shadow hover:duck-glow transition-all duration-300">
                <Settings className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Preferences</DialogTitle>
              </DialogHeader>
              
              <Tabs defaultValue="models" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="models">Models</TabsTrigger>
                  <TabsTrigger value="behavior">Behavior</TabsTrigger>
                  <TabsTrigger value="appearance">Appearance</TabsTrigger>
                </TabsList>
                
                <TabsContent value="models" className="space-y-4">
                  <div className="space-y-2">
                    <Label>Selected Model</Label>
                    <Select value={settings.model} onValueChange={(value) => onSettingsChange({ model: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {isLoading ? (
                          <SelectItem value="loading" disabled>
                            <div className="flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Loading models...
                            </div>
                          </SelectItem>
                        ) : (
                          curatedModels.map((model) => (
                            <SelectItem key={model.id} value={model.id}>
                              <div className="flex flex-col">
                                <span>{model.name}</span>
                                <span className="text-xs text-muted-foreground">{model.provider}</span>
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Favorite Models</Label>
                    <p className="text-sm text-muted-foreground">
                      Manage your starred models for quick access. (Feature coming soon)
                    </p>
                  </div>
                </TabsContent>
                
                <TabsContent value="behavior" className="space-y-4">
                  <div className="space-y-2">
                    <Label>Response Tone: {getCurrentToneLabel()}</Label>
                    <Slider
                      value={[getToneIndex()]}
                      onValueChange={handleToneChange}
                      max={TONE_OPTIONS.length - 1}
                      step={1}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Match Style</span>
                      <span>Professional</span>
                      <span>Casual</span>
                      <span>Concise</span>
                      <span>Detailed</span>
                      <span>🦆 Duck</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Enable Storage & Learning</Label>
                      <p className="text-sm text-muted-foreground">
                        Store chat history and learn from your preferences
                      </p>
                    </div>
                    <Switch
                      checked={settings.storageEnabled}
                      onCheckedChange={(checked) => onSettingsChange({ storageEnabled: checked })}
                    />
                  </div>
                </TabsContent>
                
                <TabsContent value="appearance" className="space-y-4">
                  <div className="space-y-2">
                    <Label>Theme</Label>
                    <div className="flex gap-2">
                      <Button
                        variant={theme === "light" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setTheme("light")}
                      >
                        <Sun className="h-4 w-4 mr-2" />
                        Light
                      </Button>
                      <Button
                        variant={theme === "dark" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setTheme("dark")}
                      >
                        <Moon className="h-4 w-4 mr-2" />
                        Dark
                      </Button>
                      <Button
                        variant={theme === "system" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setTheme("system")}
                      >
                        <Monitor className="h-4 w-4 mr-2" />
                        System
                      </Button>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>

          <UserMenu />
        </div>
      </div>
    </header>
  );
}