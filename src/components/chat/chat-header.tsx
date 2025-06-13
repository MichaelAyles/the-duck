"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Settings, MessageSquare, Moon, Sun, Monitor, Loader2, RotateCcw, Menu } from "lucide-react";
import { useTheme } from "next-themes";
import { ChatSettings } from "./chat-interface";
import { useModels } from "@/hooks/use-models";
import { DuckLogo } from "@/components/duck-logo";
import { UserMenu } from "@/components/auth/user-menu";
import { LearningPreferencesTab } from "./learning-preferences-tab";

interface ChatHeaderProps {
  settings: ChatSettings;
  onSettingsChange: (settings: Partial<ChatSettings>) => void;
  onEndChat: () => void;
  messageCount: number;
  onToggleMobileSidebar?: () => void;
}

const TONE_OPTIONS = [
  { value: "match-user", label: "Match User's Style", description: "Adapts to your communication style" },
  { value: "professional", label: "Professional", description: "Formal and business-like" },
  { value: "casual", label: "Casual", description: "Friendly and relaxed" },
  { value: "concise", label: "Concise", description: "Brief and to the point" },
  { value: "detailed", label: "Detailed", description: "Comprehensive explanations" },
  { value: "duck", label: "🦆 Duck Mode", description: "Quack quack quack quack quack!" },
];

export function ChatHeader({ settings, onSettingsChange, onEndChat, messageCount, onToggleMobileSidebar }: ChatHeaderProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const { 
    curatedModels, 
    allModels, 
    isLoading, 
    error, 
    starredModels, 
    activeModel, 
    isStarred,
    isActive,
    toggleStar, 
    setActive,
    resetToDefaults,
    fetchAllModels 
  } = useModels();
  
  // Suppress unused variable warning
  void activeModel;

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

  const handleResetModels = async () => {
    try {
      await resetToDefaults?.();
      setIsResetDialogOpen(false);
    } catch (error) {
      console.error('Failed to reset model preferences:', error);
    }
  };

  return (
    <header className="border-b border-border/30 bg-gradient-to-r from-background/95 via-background/98 to-background/95 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80 shadow-xl relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/3 via-transparent to-secondary/3 pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
      
      <div className="relative flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4">
          {/* Mobile Menu Button */}
          {onToggleMobileSidebar && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleMobileSidebar}
              className="lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </Button>
          )}
          
          <div className="flex items-center gap-3">
            <DuckLogo variant="full" size="lg" className="transition-all duration-300 hover:scale-110" />
          </div>
          
          <div className="hidden md:flex items-center gap-3">
            <div className="flex items-center gap-3 bg-secondary/30 backdrop-blur-sm rounded-xl px-4 py-2 border border-border/20">
              <span className="text-sm text-muted-foreground font-medium">Model:</span>
              <Select value={settings.model} onValueChange={(value) => onSettingsChange({ model: value })}>
                <SelectTrigger className="w-64 bg-background/50 border-border/30 shadow-sm hover:shadow-md transition-all duration-300 rounded-lg">
                  <SelectValue className="truncate font-medium">
                    {curatedModels.find(m => m.id === settings.model)?.name || 
                     allModels.find(m => m.id === settings.model)?.name || 
                     settings.model}
                  </SelectValue>
                </SelectTrigger>
              <SelectContent className="w-80">
                {isLoading ? (
                  <SelectItem value="loading" disabled>
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span>Loading models...</span>
                    </div>
                  </SelectItem>
                ) : (
                  <>
                    {/* Show curated models first */}
                    {curatedModels.length > 0 && (
                      <>
                        {curatedModels.map((model) => (
                          <SelectItem key={model.id} value={model.id}>
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="font-medium truncate">{model.name}</span>
                              <span className="text-xs text-muted-foreground truncate">{model.provider}</span>
                            </div>
                          </SelectItem>
                        ))}
                        {allModels.length > curatedModels.length && (
                          <>
                            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t">
                              All Models
                            </div>
                            {allModels
                              .filter(model => !curatedModels.some(curated => curated.id === model.id))
                              .slice(0, 20) // Limit to first 20 additional models for performance
                              .map((model) => (
                                <SelectItem key={model.id} value={model.id}>
                                  <div className="flex flex-col min-w-0 flex-1">
                                    <span className="font-medium truncate">{model.name}</span>
                                    <span className="text-xs text-muted-foreground truncate">{model.provider || model.id.split('/')[0]}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            {allModels.length > curatedModels.length + 20 && (
                              <div className="px-2 py-1 text-xs text-muted-foreground">
                                +{allModels.length - curatedModels.length - 20} more in settings...
                              </div>
                            )}
                          </>
                        )}
                      </>
                    )}
                    
                    {/* If no curated models, show all models */}
                    {curatedModels.length === 0 && allModels.length > 0 && (
                      allModels.slice(0, 25).map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="font-medium truncate">{model.name}</span>
                            <span className="text-xs text-muted-foreground truncate">{model.provider || model.id.split('/')[0]}</span>
                          </div>
                        </SelectItem>
                      ))
                    )}
                    
                    {/* Load all models button if not loaded yet */}
                    {allModels.length === 0 && !isLoading && (
                      <SelectItem value="load-more" disabled>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault()
                            fetchAllModels?.()
                          }}
                          className="w-full text-left text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                          Load all models...
                        </button>
                      </SelectItem>
                    )}
                  </>
                )}
              </SelectContent>
            </Select>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-3 bg-secondary/40 backdrop-blur-sm rounded-xl px-4 py-2 border border-border/20">
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
              className="hidden sm:flex bg-background/50 border-border/30 shadow-sm hover:shadow-md hover:bg-background/80 transition-all duration-300 rounded-lg"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              End Chat
            </Button>
          )}

          <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="bg-background/30 hover:bg-background/60 backdrop-blur-sm shadow-sm hover:shadow-md transition-all duration-300 rounded-lg">
                <Settings className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>Preferences</DialogTitle>
              </DialogHeader>
              
              <Tabs defaultValue="models" className="w-full flex-1 flex flex-col min-h-0">
                <TabsList className="grid w-full grid-cols-4 flex-shrink-0">
                  <TabsTrigger value="models">Models</TabsTrigger>
                  <TabsTrigger value="learning">Learning</TabsTrigger>
                  <TabsTrigger value="behavior">Behavior</TabsTrigger>
                  <TabsTrigger value="appearance">Appearance</TabsTrigger>
                </TabsList>
                
                <TabsContent value="models" className="flex-1 overflow-y-auto">
                  <div className="space-y-4 p-1">
                    <div className="space-y-2">
                      <Label>Selected Model</Label>
                    <Select value={settings.model} onValueChange={(value) => onSettingsChange({ model: value })}>
                      <SelectTrigger>
                        <SelectValue className="truncate">
                          {curatedModels.find(m => m.id === settings.model)?.name || 
                           allModels.find(m => m.id === settings.model)?.name || 
                           settings.model}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="w-96">
                        {isLoading ? (
                          <SelectItem value="loading" disabled>
                            <div className="flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Loading models...
                            </div>
                          </SelectItem>
                        ) : (
                          <>
                            {/* Show curated models first */}
                            {curatedModels.length > 0 && (
                              <>
                                {curatedModels.map((model) => (
                                  <SelectItem key={model.id} value={model.id}>
                                    <div className="flex items-center justify-between w-full min-w-0">
                                      <div className="flex flex-col min-w-0 flex-1">
                                        <span className="truncate">{model.name}</span>
                                        <span className="text-xs text-muted-foreground truncate">{model.provider}</span>
                                      </div>
                                      {model.starred && (
                                        <span className="text-yellow-500 ml-2 flex-shrink-0">⭐</span>
                                      )}
                                    </div>
                                  </SelectItem>
                                ))}
                                {allModels.length > curatedModels.length && (
                                  <>
                                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t">
                                      All Models (Select to add to favorites)
                                    </div>
                                    {allModels
                                      .filter(model => !curatedModels.some(curated => curated.id === model.id))
                                      .map((model) => (
                                        <SelectItem key={model.id} value={model.id}>
                                          <div className="flex items-center justify-between w-full min-w-0">
                                            <div className="flex flex-col min-w-0 flex-1">
                                              <span className="truncate">{model.name}</span>
                                              <span className="text-xs text-muted-foreground truncate">{model.provider || model.id.split('/')[0]}</span>
                                            </div>
                                            {model.starred && (
                                              <span className="text-yellow-500 ml-2 flex-shrink-0">⭐</span>
                                            )}
                                          </div>
                                        </SelectItem>
                                      ))}
                                  </>
                                )}
                              </>
                            )}
                            
                            {/* If no curated models, show all models */}
                            {curatedModels.length === 0 && allModels.length > 0 && (
                              allModels.map((model) => (
                                <SelectItem key={model.id} value={model.id}>
                                  <div className="flex items-center justify-between w-full min-w-0">
                                    <div className="flex flex-col min-w-0 flex-1">
                                      <span className="truncate">{model.name}</span>
                                      <span className="text-xs text-muted-foreground truncate">{model.provider || model.id.split('/')[0]}</span>
                                    </div>
                                    {model.starred && (
                                      <span className="text-yellow-500 ml-2 flex-shrink-0">⭐</span>
                                    )}
                                  </div>
                                </SelectItem>
                              ))
                            )}
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Favorite Models</Label>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIsResetDialogOpen(true)}
                          disabled={isLoading}
                          className="text-xs"
                        >
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Reset to Defaults
                        </Button>
                        <button
                          type="button"
                          onClick={() => !isLoading && fetchAllModels?.()}
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                          disabled={isLoading}
                        >
                          {allModels.length > 0 ? `${allModels.length} models` : 'Load all models'}
                        </button>
                      </div>
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
                            <div className="flex flex-col min-w-0 flex-1 mr-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-medium text-sm truncate">{model.name}</span>
                                {isActive?.(model.id) && (
                                  <span className="text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded flex-shrink-0">
                                    Active
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground truncate">{model.provider || model.id.split('/')[0]}</span>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {isStarred?.(model.id) && !isActive?.(model.id) && (
                                <button
                                  type="button"
                                  onClick={() => setActive?.(model.id)}
                                  className="text-xs text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
                                  title="Set as active model"
                                >
                                  Set Active
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
                  </div>
                </TabsContent>
                
                <TabsContent value="learning" className="flex-1 overflow-y-auto p-1">
                  <LearningPreferencesTab />
                </TabsContent>
                
                <TabsContent value="behavior" className="flex-1 overflow-y-auto">
                  <div className="space-y-4 p-1">
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
                  </div>
                </TabsContent>
                
                <TabsContent value="appearance" className="flex-1 overflow-y-auto">
                  <div className="space-y-4 p-1">
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
                  </div>
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>

          <UserMenu />
        </div>
      </div>
      
      <AlertDialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Model Preferences?</AlertDialogTitle>
            <AlertDialogDescription>
              This will reset your favorite models and active model back to the default curated selection:
              <br /><br />
              • Google Gemini 2.5 Flash (Primary)
              <br />
              • Google Gemini 2.5 Pro
              <br />
              • DeepSeek v3
              <br />
              • Claude Sonnet 4
              <br />
              • GPT-4o Mini
              <br /><br />
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetModels} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Resetting...
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset to Defaults
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </header>
  );
}