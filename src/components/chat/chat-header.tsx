"use client";

import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Settings, MessageSquare, Moon, Sun, Monitor, Loader2, RotateCcw, Menu, Trash2, ChevronDown, Filter } from "lucide-react";
import { useTheme } from "next-themes";
import { ChatSettings } from "./chat-interface";
import { useModels } from "@/hooks/use-models";
import { DuckLogo } from "@/components/duck-logo";
import { UserMenu } from "@/components/auth/user-menu";
import { LearningPreferencesTab } from "./learning-preferences-tab";
import { UsageSummary } from "@/components/settings/usage-summary";
import { UploadHistory } from "@/components/settings/upload-history";
import { useToast } from "@/hooks/use-toast";

interface ChatHeaderProps {
  settings: ChatSettings;
  onSettingsChange: (settings: Partial<ChatSettings>) => void;
  onEndChat: () => void;
  messageCount: number;
  onToggleMobileSidebar?: () => void;
  userId?: string;
}

const TONE_OPTIONS = [
  { value: "match-user", label: "Match User&apos;s Style", description: "Adapts to your communication style" },
  { value: "professional", label: "Professional", description: "Formal and business-like" },
  { value: "casual", label: "Casual", description: "Friendly and relaxed" },
  { value: "concise", label: "Concise", description: "Brief and to the point" },
  { value: "detailed", label: "Detailed", description: "Comprehensive explanations" },
  { value: "duck", label: "Duck Mode", description: "Your personal duck responds in quacks!" },
];

export function ChatHeader({ settings, onSettingsChange, onEndChat, messageCount, onToggleMobileSidebar, userId }: ChatHeaderProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isResetKnowledgeOpen, setIsResetKnowledgeOpen] = useState(false);
  const [isDeleteHistoryOpen, setIsDeleteHistoryOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isPreloading, setIsPreloading] = useState(false);
  const [preloadComplete, setPreloadComplete] = useState(false);
  const [preloadedData, setPreloadedData] = useState<{
    models: boolean;
    learning: boolean;
    usage: boolean;
  }>({ models: false, learning: false, usage: false });
  
  // Model sorting and filtering state
  const [modelSortBy, setModelSortBy] = useState<'name' | 'provider' | 'cost' | 'context' | 'latency' | 'date'>('name');
  const [modelSortOrder, setModelSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [isProviderDropdownOpen, setIsProviderDropdownOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  // Lazy load models - only when user opens the dropdown
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const models = useModels();
  
  // CRITICAL FIX: Memoize model loading to prevent recreation
  const handleModelDropdownOpen = useCallback(async () => {
    if (!modelsLoaded) {
      setModelsLoaded(true);
      await models.initializeCuratedModels();
    }
  }, [modelsLoaded, models.initializeCuratedModels]); // eslint-disable-line react-hooks/exhaustive-deps
  // Note: Using specific function reference to prevent recreation
  
  // Extract models conditionally - memoize to prevent object recreation
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
  } = models;
  
  // Suppress unused variable warning
  void activeModel;

  // CRITICAL FIX: Memoize model name computation with stable dependencies
  const currentModelName = useMemo(() => {
    return curatedModels.find(m => m.id === settings.model)?.name || 
           allModels.find(m => m.id === settings.model)?.name || 
           settings.model;
  }, [curatedModels, allModels, settings.model]);

  // CRITICAL FIX: Stable additional models computation
  const additionalModels = useMemo(() => {
    return allModels.filter(model => !curatedModels.some(curated => curated.id === model.id));
  }, [allModels, curatedModels]);

  // Model sorting function
  const sortModels = useCallback((models: typeof allModels) => {
    return [...models].sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (modelSortBy) {
        case 'name':
          aValue = a.name?.toLowerCase() || a.id.toLowerCase();
          bValue = b.name?.toLowerCase() || b.id.toLowerCase();
          break;
        case 'provider':
          aValue = (a.provider || a.id.split('/')[0]).toLowerCase();
          bValue = (b.provider || b.id.split('/')[0]).toLowerCase();
          break;
        case 'cost':
          // Sort by combined cost (prompt + completion per 1M tokens)
          aValue = Number(a.pricing?.prompt || 0) + Number(a.pricing?.completion || 0);
          bValue = Number(b.pricing?.prompt || 0) + Number(b.pricing?.completion || 0);
          break;
        case 'context':
          aValue = a.context_length || 0;
          bValue = b.context_length || 0;
          break;
        case 'latency':
          // Sort by p50 latency (50th percentile), fallback to p95, then 0
          aValue = a.latency?.p50 || a.latency?.p95 || 999999;
          bValue = b.latency?.p50 || b.latency?.p95 || 999999;
          break;
        case 'date':
          // For "date added", we'll use the order from OpenRouter (models with higher ranks were added earlier)
          // If no ranking data, sort by ID as fallback
          aValue = a.id;
          bValue = b.id;
          break;
        default:
          aValue = a.name?.toLowerCase() || a.id.toLowerCase();
          bValue = b.name?.toLowerCase() || b.id.toLowerCase();
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const result = aValue.localeCompare(bValue);
        return modelSortOrder === 'asc' ? result : -result;
      } else {
        const result = (aValue as number) - (bValue as number);
        return modelSortOrder === 'asc' ? result : -result;
      }
    });
  }, [modelSortBy, modelSortOrder]);

  // Get unique providers from all models
  const availableProviders = useMemo(() => {
    const allAvailable = [...curatedModels, ...additionalModels];
    const providers = new Set<string>();
    allAvailable.forEach(model => {
      const provider = model.provider || model.id.split('/')[0];
      if (provider) providers.add(provider);
    });
    return Array.from(providers).sort();
  }, [curatedModels, additionalModels]);

  // Filter models by selected providers
  const filterByProvider = useCallback((models: typeof allModels) => {
    if (selectedProviders.length === 0) return models;
    return models.filter(model => {
      const provider = model.provider || model.id.split('/')[0];
      return selectedProviders.includes(provider);
    });
  }, [selectedProviders]);

  // Sorted and filtered models for display
  const sortedAvailableModels = useMemo(() => {
    const allAvailable = [...curatedModels, ...additionalModels];
    const filtered = filterByProvider(allAvailable);
    return sortModels(filtered);
  }, [curatedModels, additionalModels, filterByProvider, sortModels]);

  // CRITICAL FIX: Stable available models list (now sorted)
  const availableModels = useMemo(() => {
    return allModels.length > 0 ? sortedAvailableModels : sortModels(curatedModels);
  }, [allModels, sortedAvailableModels, curatedModels, sortModels]);

  // CRITICAL FIX: Stable model change handler
  const handleModelChange = useCallback((value: string) => {
    onSettingsChange({ model: value });
  }, [onSettingsChange]);

  // Preload all data for preferences tabs
  const preloadAllData = useCallback(async () => {
    if (preloadComplete) return;
    
    setIsPreloading(true);
    
    try {
      // Preload models data
      if (!preloadedData.models) {
        await handleModelDropdownOpen();
        if (allModels.length === 0) {
          await fetchAllModels?.();
        }
        setPreloadedData(prev => ({ ...prev, models: true }));
      }
      
      // Preload learning preferences data
      if (!preloadedData.learning) {
        // The LearningPreferencesTab component will handle its own data loading
        // We just mark it as "preloaded" to indicate we've initiated the process
        setPreloadedData(prev => ({ ...prev, learning: true }));
      }
      
      // Preload usage data
      if (!preloadedData.usage) {
        // The UsageSummary component will handle its own data loading
        // We just mark it as "preloaded" to indicate we've initiated the process
        setPreloadedData(prev => ({ ...prev, usage: true }));
      }
      
      setPreloadComplete(true);
    } catch (error) {
      console.error('Failed to preload data:', error);
    } finally {
      setIsPreloading(false);
    }
  }, [preloadComplete, preloadedData, handleModelDropdownOpen, allModels.length, fetchAllModels]);

  // CRITICAL FIX: Stable reference to prevent Select re-rendering
  const handleModelDropdownOpenChange = useCallback((open: boolean) => {
    if (open) {
      handleModelDropdownOpen();
    }
  }, [handleModelDropdownOpen]);

  const handleToneChange = useCallback((value: number[]) => {
    const toneValue = TONE_OPTIONS[value[0]]?.value || "match-user";
    onSettingsChange({ tone: toneValue });
  }, [onSettingsChange]);

  const handleStorageToggle = useCallback((checked: boolean) => {
    onSettingsChange({ storageEnabled: checked });
  }, [onSettingsChange]);

  const getToneIndex = () => {
    return TONE_OPTIONS.findIndex(option => option.value === settings.tone);
  };

  const getCurrentToneLabel = () => {
    return TONE_OPTIONS.find(option => option.value === settings.tone)?.label || "Match User's Style";
  };

  // CRITICAL FIX: Memoize model options to prevent Select re-rendering
  const modelOptions = useMemo(() => {
    if (isLoading) {
      return (
        <SelectItem value="loading" disabled>
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span>Loading models...</span>
          </div>
        </SelectItem>
      );
    }

    const options = [];

    // Show curated models first
    if (curatedModels.length > 0) {
      curatedModels.forEach((model) => {
        options.push(
          <SelectItem key={model.id} value={model.id}>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="font-medium truncate">{model.name}</span>
              <span className="text-xs text-muted-foreground truncate">{model.provider}</span>
            </div>
          </SelectItem>
        );
      });

      if (additionalModels.length > 0) {
        options.push(
          <div key="divider" className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t">
            All Models
          </div>
        );
        
        additionalModels.slice(0, 20).forEach((model) => {
          options.push(
            <SelectItem key={model.id} value={model.id}>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="font-medium truncate">{model.name}</span>
                <span className="text-xs text-muted-foreground truncate">{model.provider || model.id.split('/')[0]}</span>
              </div>
            </SelectItem>
          );
        });

        if (additionalModels.length > 20) {
          options.push(
            <div key="more" className="px-2 py-1 text-xs text-muted-foreground">
              +{additionalModels.length - 20} more in settings...
            </div>
          );
        }
      }
    } else if (allModels.length > 0) {
      // If no curated models, show all models
      availableModels.slice(0, 25).forEach((model) => {
        options.push(
          <SelectItem key={model.id} value={model.id}>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="font-medium truncate">{model.name}</span>
              <span className="text-xs text-muted-foreground truncate">{model.provider || model.id.split('/')[0]}</span>
            </div>
          </SelectItem>
        );
      });
    } else {
      // Load all models option
      options.push(
        <SelectItem key="load-more" value="load-more" disabled>
          <span className="text-sm text-muted-foreground">
            Load all models...
          </span>
        </SelectItem>
      );
    }

    return options;
  }, [isLoading, curatedModels, additionalModels, allModels, availableModels]);

  const handleResetModels = async () => {
    try {
      await resetToDefaults?.();
      setIsResetDialogOpen(false);
    } catch (error) {
      console.error('Failed to reset model preferences:', error);
    }
  };

  const handleResetKnowledge = async () => {
    setIsResetting(true);
    try {
      const response = await fetch('/api/learning-preferences', {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to reset knowledge');
      }

      toast({
        title: "Knowledge Reset",
        description: "All learned preferences have been cleared.",
      });
      setIsResetKnowledgeOpen(false);
    } catch (error) {
      console.error('Failed to reset knowledge:', error);
      toast({
        title: "Error",
        description: "Failed to reset knowledge. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsResetting(false);
    }
  };

  const handleDeleteAllHistory = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch('/api/chat-history', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ deleteAll: true }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete chat history');
      }

      toast({
        title: "History Deleted",
        description: "All chat conversations have been permanently deleted.",
      });
      setIsDeleteHistoryOpen(false);
      
      // Trigger a new chat since all history is gone
      onEndChat();
    } catch (error) {
      console.error('Failed to delete chat history:', error);
      toast({
        title: "Error",
        description: "Failed to delete chat history. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
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
              <Select value={settings.model} onValueChange={handleModelChange} onOpenChange={handleModelDropdownOpenChange}>
                <SelectTrigger className="w-64 bg-background/50 border-border/30 shadow-sm hover:shadow-md transition-all duration-300 rounded-lg">
                  <SelectValue className="truncate font-medium">
                    {currentModelName}
                  </SelectValue>
                </SelectTrigger>
              <SelectContent className="w-80">
                {modelOptions}
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
              onCheckedChange={handleStorageToggle}
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

          <Dialog open={isSettingsOpen} onOpenChange={(open) => {
            setIsSettingsOpen(open);
            if (open && !preloadComplete) {
              preloadAllData();
            }
          }}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="bg-background/30 hover:bg-background/60 backdrop-blur-sm shadow-sm hover:shadow-md transition-all duration-300 rounded-lg">
                <Settings className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  Preferences
                  {isPreloading && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                  {preloadComplete && !isPreloading && (
                    <span className="text-xs text-green-600 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded-full">
                      Ready
                    </span>
                  )}
                </DialogTitle>
              </DialogHeader>
              
              <Tabs defaultValue="models" className="w-full flex-1 flex flex-col min-h-0">
                <TabsList className="grid w-full grid-cols-6 flex-shrink-0">
                  <TabsTrigger value="models" className="relative">
                    Models
                    {!preloadedData.models && isPreloading && (
                      <div className="absolute -top-1 -right-1 h-2 w-2 bg-primary rounded-full animate-pulse" />
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="learning" className="relative">
                    Learning
                    {!preloadedData.learning && isPreloading && (
                      <div className="absolute -top-1 -right-1 h-2 w-2 bg-primary rounded-full animate-pulse" />
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="behavior">Behavior</TabsTrigger>
                  <TabsTrigger value="usage" className="relative">
                    Usage
                    {!preloadedData.usage && isPreloading && (
                      <div className="absolute -top-1 -right-1 h-2 w-2 bg-primary rounded-full animate-pulse" />
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="settings">Settings</TabsTrigger>
                  <TabsTrigger value="uploads">Uploads</TabsTrigger>
                </TabsList>
                
                <TabsContent value="models" className="flex-1 overflow-y-auto">
                  <div className="space-y-4 p-1">
                    <div className="space-y-2">
                      <Label>Selected Model</Label>
                    <Select value={settings.model} onValueChange={handleModelChange} onOpenChange={handleModelDropdownOpenChange}>
                      <SelectTrigger>
                        <SelectValue className="truncate">
                          {currentModelName}
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
                                {additionalModels.length > 0 && (
                                  <>
                                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t">
                                      All Models (Select to add to favorites)
                                    </div>
                                    {additionalModels.map((model) => (
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
                              availableModels.map((model) => (
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
                          onClick={async () => {
                            if (!isLoading) {
                              await handleModelDropdownOpen();
                              await fetchAllModels?.();
                            }
                          }}
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
                    
                    {/* Model sorting and filtering controls */}
                    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
                      <Label className="text-xs font-medium text-muted-foreground">Sort:</Label>
                      <Select value={modelSortBy} onValueChange={(value: typeof modelSortBy) => setModelSortBy(value)}>
                        <SelectTrigger className="w-32 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="name">Name</SelectItem>
                          <SelectItem value="provider">Provider</SelectItem>
                          <SelectItem value="cost">Cost</SelectItem>
                          <SelectItem value="context">Context Length</SelectItem>
                          <SelectItem value="latency">Latency</SelectItem>
                          <SelectItem value="date">Date Added</SelectItem>
                        </SelectContent>
                      </Select>
                      <button
                        type="button"
                        onClick={() => setModelSortOrder(modelSortOrder === 'asc' ? 'desc' : 'asc')}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors rounded border"
                        title={`Sort ${modelSortOrder === 'asc' ? 'descending' : 'ascending'}`}
                      >
                        {modelSortOrder === 'asc' ? '↑' : '↓'}
                        {modelSortOrder === 'asc' ? 'Asc' : 'Desc'}
                      </button>
                      
                      <Separator orientation="vertical" className="h-6" />
                      
                      <Label className="text-xs font-medium text-muted-foreground">Filter:</Label>
                      <div className="relative">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 border-dashed text-xs justify-start"
                          onClick={() => setIsProviderDropdownOpen(!isProviderDropdownOpen)}
                        >
                          <Filter className="mr-2 h-3 w-3" />
                          {selectedProviders.length === 0
                            ? "All providers"
                            : selectedProviders.length === 1
                            ? selectedProviders[0]
                            : `${selectedProviders.length} selected`
                          }
                          <ChevronDown className="ml-auto h-3 w-3" />
                        </Button>
                        
                        {isProviderDropdownOpen && (
                          <>
                            {/* Backdrop */}
                            <div 
                              className="fixed inset-0 z-40" 
                              onClick={() => setIsProviderDropdownOpen(false)}
                            />
                            
                            {/* Dropdown */}
                            <div className="absolute top-full left-0 z-50 mt-1 w-56 bg-popover border border-border rounded-md shadow-lg">
                              <div className="p-3 pb-2 border-b">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-sm font-medium">Filter by Provider</h4>
                                  {selectedProviders.length > 0 && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setSelectedProviders([])}
                                      className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                                    >
                                      Clear
                                    </Button>
                                  )}
                                </div>
                              </div>
                              <div 
                                className="p-3 pt-2 overflow-auto"
                                style={{
                                  height: '240px',
                                  maxHeight: '240px'
                                }}
                              >
                                <div className="space-y-1">
                                  {availableProviders.length === 0 ? (
                                    <div className="flex items-center justify-center py-8">
                                      <span className="text-xs text-muted-foreground">Loading providers...</span>
                                    </div>
                                  ) : (
                                    availableProviders.map((provider) => (
                                      <div key={provider} className="flex items-center space-x-2 py-1.5 hover:bg-muted/50 rounded px-1">
                                        <Checkbox
                                          id={`provider-${provider}`}
                                          checked={selectedProviders.includes(provider)}
                                          onCheckedChange={(checked) => {
                                            if (checked) {
                                              setSelectedProviders(prev => [...prev, provider]);
                                            } else {
                                              setSelectedProviders(prev => prev.filter(p => p !== provider));
                                            }
                                          }}
                                        />
                                        <Label
                                          htmlFor={`provider-${provider}`}
                                          className="text-sm font-normal cursor-pointer flex-1"
                                        >
                                          {provider}
                                        </Label>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    
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
                      ) : availableModels.length > 0 ? (
                        availableModels.map((model) => (
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
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <span className="truncate">{model.provider || model.id.split('/')[0]}</span>
                                {model.context_length && (
                                  <span className="flex-shrink-0">
                                    {Math.round(Number(model.context_length) / 1000)}k ctx
                                  </span>
                                )}
                                {model.pricing && (model.pricing.prompt || model.pricing.completion) && (
                                  <span className="flex-shrink-0">
                                    £{(Number(model.pricing.prompt || 0) + Number(model.pricing.completion || 0)).toFixed(2)}/1M
                                  </span>
                                )}
                                {model.latency && (model.latency.p50 || model.latency.p95) && (
                                  <span className="flex-shrink-0">
                                    {Math.round(model.latency.p50 || model.latency.p95 || 0)}ms
                                  </span>
                                )}
                              </div>
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
                  {isPreloading && !preloadedData.learning ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Loading learning preferences...</span>
                      </div>
                    </div>
                  ) : (
                    <LearningPreferencesTab />
                  )}
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
                      <span>Duck</span>
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
                      onCheckedChange={handleStorageToggle}
                    />
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Flow Mode</Label>
                        <p className="text-sm text-muted-foreground">
                          Continue on the user&apos;s conversation flow with context from previous chats
                        </p>
                      </div>
                      <Switch
                        checked={settings.memoryEnabled}
                        onCheckedChange={(checked) => onSettingsChange({ memoryEnabled: checked })}
                      />
                    </div>

                    {settings.memoryEnabled && (
                      <div className="space-y-2">
                        <Label>Memory Conversations: {settings.memorySummaryCount}</Label>
                        <Slider
                          value={[settings.memorySummaryCount]}
                          onValueChange={([value]) => onSettingsChange({ memorySummaryCount: value })}
                          min={1}
                          max={10}
                          step={1}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>1 conversation</span>
                          <span>5 conversations</span>
                          <span>10 conversations</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Number of previous conversation summaries to include for context
                        </p>
                      </div>
                    )}
                  </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="usage" className="flex-1 overflow-y-auto p-1">
                  {isPreloading && !preloadedData.usage ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Loading usage data...</span>
                      </div>
                    </div>
                  ) : (
                    <UsageSummary />
                  )}
                </TabsContent>
                
                <TabsContent value="settings" className="flex-1 overflow-y-auto">
                  <div className="space-y-6 p-1">
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
                    
                    <Separator />
                    
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-lg font-medium">Data Management</h3>
                        <p className="text-sm text-muted-foreground">
                          Manage your personal data and preferences
                        </p>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label>Reset Knowledge</Label>
                            <p className="text-sm text-muted-foreground">
                              Clear all learned preferences and reset to defaults
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsResetKnowledgeOpen(true)}
                            className="text-destructive hover:text-destructive"
                          >
                            <RotateCcw className="h-4 w-4 mr-2" />
                            Reset
                          </Button>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label>Delete All Chat History</Label>
                            <p className="text-sm text-muted-foreground">
                              Permanently delete all your chat conversations
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsDeleteHistoryOpen(true)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="uploads" className="flex-1 overflow-y-auto p-1">
                  <UploadHistory userId={userId} />
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
      
      {/* Reset Knowledge Confirmation Dialog */}
      <AlertDialog open={isResetKnowledgeOpen} onOpenChange={setIsResetKnowledgeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset All Knowledge?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all learned preferences and reset your personalization to defaults.
              <br /><br />
              This includes:
              <br />
              • All learning preferences
              <br />
              • Chat summaries and patterns
              <br />
              • Personalization data
              <br /><br />
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleResetKnowledge} 
              disabled={isResetting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isResetting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Resetting...
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset Knowledge
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Delete All History Confirmation Dialog */}
      <AlertDialog open={isDeleteHistoryOpen} onOpenChange={setIsDeleteHistoryOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete All Chat History?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete ALL your chat conversations. 
              <br /><br />
              You will lose:
              <br />
              • All chat messages
              <br />
              • All conversation history
              <br />
              • All session data
              <br /><br />
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteAllHistory} 
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete All History
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </header>
  );
}