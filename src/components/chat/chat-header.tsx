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
  const { 
    curatedModels, 
    allModels, 
    isLoading, 
    error, 
    starredModels, 
    primaryModel, 
    isStarred,
    isPrimary,
    toggleStar, 
    setPrimary,
    fetchAllModels 
  } = useModels();

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
                              <div className="flex items-center justify-between w-full">
                                <div className="flex flex-col">
                                  <span>{model.name}</span>
                                  <span className="text-xs text-muted-foreground">{model.provider}</span>
                                </div>
                                {model.starred && (
                                  <span className="text-yellow-500 ml-2">⭐</span>
                                )}
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Favorite Models</Label>
                      <button
                        type="button"
                        onClick={() => !isLoading && fetchAllModels?.()}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        disabled={isLoading}
                      >
                        {allModels.length > 0 ? `${allModels.length} models` : 'Load all models'}
                      </button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Click the stars to manage your favorite models. Your curated top 5 models include Google Gemini 2.5, DeepSeek v3, Claude Sonnet 4, and GPT-4o Mini.
                    </p>
                    
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {error ? (
                        <div className="p-3 rounded-lg border border-destructive bg-destructive/10">
                          <p className="text-sm font-medium text-destructive">Configuration Error</p>
                          <p className="text-xs text-muted-foreground mt-1">{error}</p>
                          <p className="text-xs text-muted-foreground mt-2">
                            Please check your environment variables:
                          </p>
                          <ul className="text-xs text-muted-foreground mt-1 list-disc list-inside">
                            <li>OPENROUTER_API_KEY</li>
                            <li>NEXT_PUBLIC_SUPABASE_URL</li>
                            <li>NEXT_PUBLIC_SUPABASE_ANON_KEY</li>
                          </ul>
                        </div>
                      ) : (allModels.length > 0 ? allModels : curatedModels).length > 0 ? (
                        (allModels.length > 0 ? allModels : curatedModels).map((model) => (
                          <div key={model.id} className="flex items-center justify-between p-2 rounded-lg border bg-background">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">{model.name}</span>
                                {isPrimary?.(model.id) && (
                                  <span className="text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
                                    Primary
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground">{model.provider || model.id.split('/')[0]}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {isStarred?.(model.id) && !isPrimary?.(model.id) && (
                                <button
                                  type="button"
                                  onClick={() => setPrimary?.(model.id)}
                                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                                  title="Set as primary model"
                                >
                                  Set Primary
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => toggleStar?.(model.id)}
                                className="text-lg hover:scale-110 transition-transform"
                                title={isStarred?.(model.id) ? 'Remove from favorites' : 'Add to favorites'}
                              >
                                {isStarred?.(model.id) ? '⭐' : '☆'}
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-3 rounded-lg border bg-muted/50">
                          <p className="text-sm text-muted-foreground">No models available</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Check your API configuration or try loading all models.
                          </p>
                        </div>
                      )}
                    </div>
                    
                    {starredModels?.length > 0 && (
                      <div className="pt-2 border-t">
                        <p className="text-xs text-muted-foreground">
                          {starredModels.length} starred model{starredModels.length !== 1 ? 's' : ''} 
                          {allModels.length > 0 && ` out of ${allModels.length} total`}
                        </p>
                      </div>
                    )}
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