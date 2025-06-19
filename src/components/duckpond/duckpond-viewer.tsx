"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Artifact, ArtifactExecution } from '@/types/artifact';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  Play, 
  Edit, 
  Download, 
  RefreshCw, 
  AlertTriangle,
  CheckCircle,
  Code,
  Eye,
  Maximize2,
  Minimize2,
  Square,
  RotateCcw
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DuckPondViewerProps {
  artifact: Artifact;
  className?: string;
  onEdit?: (artifact: Artifact) => void;
  onExecute?: (artifact: Artifact) => void;
  initialTab?: 'preview' | 'code';
  enableFullscreen?: boolean;
  hideHeader?: boolean;
  externalExecution?: ArtifactExecution;
  onExecutionChange?: (execution: ArtifactExecution) => void;
}

export function DuckPondViewer({
  artifact,
  className,
  onEdit,
  onExecute,
  initialTab = 'preview',
  enableFullscreen = true,
  hideHeader = false,
  externalExecution,
  onExecutionChange,
}: DuckPondViewerProps) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [execution, setExecution] = useState<ArtifactExecution>(
    externalExecution || {
      artifactId: artifact.id,
      status: 'idle',
    }
  );

  // Use external execution state when provided
  const currentExecution = externalExecution || execution;
  
  const updateExecution = useCallback((newExecution: ArtifactExecution | ((prev: ArtifactExecution) => ArtifactExecution)) => {
    if (onExecutionChange) {
      if (typeof newExecution === 'function') {
        onExecutionChange(newExecution(currentExecution));
      } else {
        onExecutionChange(newExecution);
      }
    } else {
      setExecution(newExecution);
    }
  }, [onExecutionChange, currentExecution]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const executeArtifact = useCallback(async () => {
    if (!iframeRef.current) return;

    const iframe = iframeRef.current;
    
    try {
      // Create sandbox HTML content
      const sandboxContent = createSandboxContent(artifact);
      
      // Write content to iframe with enhanced error handling
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (doc) {
        // Clear any existing content first
        doc.open();
        doc.write(sandboxContent);
        doc.close();
        
        // For interactive components, ensure iframe can handle events
        iframe.style.pointerEvents = 'auto';
        iframe.style.overflow = 'hidden';
        
        console.log('🦆 DuckPond artifact executed:', {
          type: artifact.type,
          title: artifact.title,
          interactive: artifact.type === 'react-component'
        });
      }
    } catch (error) {
      console.error('DuckPond execution error:', error);
      updateExecution((prev: ArtifactExecution) => ({
        ...prev,
        status: 'error' as const,
        error: error instanceof Error ? error.message : 'Failed to execute component',
      }));
    }
  }, [artifact, updateExecution]);

  const handleExecute = useCallback(async () => {
    if (currentExecution.status === 'executing') return;

    updateExecution(prev => ({ 
      ...prev, 
      status: 'executing' as const,
      error: undefined // Clear any previous errors
    }));

    try {
      // Execute the artifact
      if (onExecute) {
        await onExecute(artifact);
      } else {
        await executeArtifact();
      }

      updateExecution(prev => ({
        ...prev,
        status: 'success' as const,
        lastExecuted: new Date(),
      }));
    } catch (error) {
      updateExecution(prev => ({
        ...prev,
        status: 'error' as const,
        error: error instanceof Error ? error.message : 'Execution failed',
      }));
    }
  }, [artifact, currentExecution.status, onExecute, executeArtifact, updateExecution]);

  const handleStop = useCallback(() => {
    if (!iframeRef.current) return;
    
    // Stop execution by clearing iframe content
    const iframe = iframeRef.current;
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(`
        <html>
          <head><title>DuckPond - Stopped</title></head>
          <body style="display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; font-family: system-ui, sans-serif; color: #666;">
            <div style="text-align: center;">
              <div style="font-size: 48px; margin-bottom: 16px;">⏹️</div>
              <div>Execution stopped</div>
              <div style="font-size: 12px; margin-top: 8px;">Click Run to restart</div>
            </div>
          </body>
        </html>
      `);
      doc.close();
    }
    
    updateExecution(prev => ({
      ...prev,
      status: 'stopped' as const,
    }));
  }, [updateExecution]);

  const handleReset = useCallback(() => {
    if (!iframeRef.current) return;
    
    try {
      // Reset iframe and clean up any running animations/timers
      const iframe = iframeRef.current;
      const iframeWindow = iframe.contentWindow;
      
      // Try to clean up any running timers/animations in the iframe
      if (iframeWindow) {
        try {
          // Clear any active timers - use a safer approach
          const highestTimeoutId = iframeWindow.setTimeout(() => {}, 0);
          for (let i = 0; i <= Math.min(highestTimeoutId, 1000); i++) {
            iframeWindow.clearTimeout(i);
            iframeWindow.clearInterval(i);
          }
        } catch {
          // Ignore errors in cleanup
        }
      }
      
      const doc = iframe.contentDocument || iframeWindow?.document;
      if (doc) {
        doc.open();
        doc.write(`
          <html>
            <head>
              <title>DuckPond - Ready</title>
              <style>
                body { 
                  display: flex; 
                  align-items: center; 
                  justify-content: center; 
                  height: 100vh; 
                  margin: 0; 
                  font-family: system-ui, sans-serif; 
                  color: #666;
                  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
                }
                .ready-state {
                  text-align: center;
                  padding: 2rem;
                  border-radius: 1rem;
                  background: rgba(255, 255, 255, 0.8);
                  backdrop-filter: blur(10px);
                  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
                }
                .duck-icon {
                  font-size: 3rem;
                  margin-bottom: 1rem;
                  animation: float 2s ease-in-out infinite;
                }
                @keyframes float {
                  0%, 100% { transform: translateY(0px); }
                  50% { transform: translateY(-10px); }
                }
              </style>
            </head>
            <body>
              <div class="ready-state">
                <div class="duck-icon">🦆</div>
                <div style="font-size: 1.2rem; font-weight: 500;">Ready to run</div>
                <div style="font-size: 0.9rem; margin-top: 0.5rem; opacity: 0.7;">Click Run to execute interactive component</div>
              </div>
            </body>
          </html>
        `);
        doc.close();
      }
      
      updateExecution(prev => ({
        ...prev,
        status: 'idle' as const,
        error: undefined,
        lastExecuted: undefined,
      }));
      
      console.log('🔄 DuckPond reset - ready for new execution');
    } catch (error) {
      console.error('Reset error:', error);
    }
  }, [updateExecution]);

  const handleDownload = () => {
    const blob = new Blob([artifact.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${artifact.title}.${getFileExtension(artifact.type)}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getStatusIcon = () => {
    switch (currentExecution.status) {
      case 'executing':
        return <RefreshCw className="h-4 w-4 animate-spin" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'stopped':
        return <Square className="h-4 w-4 text-orange-500" />;
      default:
        return <Play className="h-4 w-4" />;
    }
  };

  const getStatusColor = () => {
    switch (currentExecution.status) {
      case 'executing':
        return 'bg-blue-500';
      case 'success':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      case 'stopped':
        return 'bg-orange-500';
      default:
        return 'bg-gray-500';
    }
  };

  useEffect(() => {
    // Auto-execute on mount for React components, but only once per artifact
    if (artifact.type === 'react-component' && currentExecution.status === 'idle') {
      // Add a small delay to ensure iframe is ready
      const timeoutId = setTimeout(() => {
        handleExecute();
      }, 100);
      
      return () => clearTimeout(timeoutId);
    }
  }, [artifact.id, artifact.type, currentExecution.status, handleExecute]);

  return (
    <Card className={cn(
      "w-full transition-all duration-200",
      isFullscreen && "fixed inset-4 z-50 h-[calc(100vh-2rem)]",
      className
    )}>
      {!hideHeader && (
        <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">{artifact.title}</CardTitle>
            <Badge variant="secondary" className="text-xs">
              {artifact.type}
            </Badge>
            <div className={cn(
              "w-2 h-2 rounded-full",
              getStatusColor()
            )} />
          </div>
          
          <div className="flex items-center gap-1">
            {/* Run/Stop Button Group */}
            <div className="flex items-center bg-muted rounded-md">
              <Button
                variant="ghost"
                size="sm"
                onClick={currentExecution.status === 'executing' ? handleStop : handleExecute}
                disabled={false}
                className="rounded-r-none"
              >
                {currentExecution.status === 'executing' ? (
                  <Square className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                <span className="ml-1 text-xs">
                  {currentExecution.status === 'executing' ? 'Stop' : 'Run'}
                </span>
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                disabled={currentExecution.status === 'executing'}
                className="rounded-l-none border-l px-2"
                title="Reset to initial state"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Status Indicator */}
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {getStatusIcon()}
              <span>
                {currentExecution.status === 'executing' && 'Running...'}
                {currentExecution.status === 'success' && 'Ready'}
                {currentExecution.status === 'error' && 'Error'}
                {currentExecution.status === 'stopped' && 'Stopped'}
                {currentExecution.status === 'idle' && 'Ready'}
              </span>
            </div>
            
            {onEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(artifact)}
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownload}
            >
              <Download className="h-4 w-4" />
            </Button>
            
            {enableFullscreen && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsFullscreen(!isFullscreen)}
              >
                {isFullscreen ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        </div>
        
        {artifact.description && (
          <p className="text-sm text-muted-foreground mt-1">
            {artifact.description}
          </p>
        )}
        
        {currentExecution.error && (
          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            <div className="flex items-center gap-1">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-medium">Execution Error:</span>
            </div>
            <div className="mt-1">{currentExecution.error}</div>
          </div>
        )}
      </CardHeader>
      )}

      <CardContent className={cn("pt-0", hideHeader && "pt-4")}>
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'preview' | 'code')} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="preview" className="flex items-center gap-1">
              <Eye className="h-4 w-4" />
              Preview
            </TabsTrigger>
            <TabsTrigger value="code" className="flex items-center gap-1">
              <Code className="h-4 w-4" />
              Code
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="preview" className="mt-4">
            <div className="border rounded-lg bg-white dark:bg-gray-950">
              <iframe
                ref={iframeRef}
                className="w-full h-64 rounded-lg border-0"
                title={`${artifact.title} Interactive Preview`}
                sandbox="allow-scripts allow-same-origin allow-forms allow-pointer-lock allow-popups"
                style={{ 
                  minHeight: isFullscreen ? '60vh' : '20rem',
                  background: 'transparent',
                  pointerEvents: 'auto'
                }}
                allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
              />
            </div>
          </TabsContent>
          
          <TabsContent value="code" className="mt-4">
            <div className="border rounded-lg bg-gray-50 dark:bg-gray-900">
              <pre className="p-4 text-sm overflow-auto max-h-64 font-mono">
                <code>{artifact.content}</code>
              </pre>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// Helper functions

function createSandboxContent(artifact: Artifact): string {
  switch (artifact.type) {
    case 'react-component':
      return createReactSandbox(artifact.content);
    case 'html':
      return artifact.content;
    case 'javascript':
      return createJavaScriptSandbox(artifact.content);
    default:
      return `<pre>${artifact.content}</pre>`;
  }
}

function createReactSandbox(content: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>DuckPond Interactive React Component</title>
  <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <style>
    body { 
      margin: 16px; 
      font-family: system-ui, -apple-system, sans-serif;
      overflow: hidden; /* Prevent iframe scrollbars for animations */
    }
    #root {
      width: 100%;
      height: calc(100vh - 32px);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .error { 
      color: red; 
      background: #fee; 
      padding: 8px; 
      border-radius: 4px; 
      margin: 8px 0;
      max-width: 100%;
      word-wrap: break-word;
    }
    /* Enable smooth animations */
    * {
      box-sizing: border-box;
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    try {
      // Provide ALL React hooks for maximum compatibility
      const { 
        useState, 
        useEffect, 
        useCallback, 
        useMemo, 
        useRef,
        useReducer,
        useContext,
        useLayoutEffect,
        useImperativeHandle,
        useDeferredValue,
        useTransition,
        useId,
        useSyncExternalStore
      } = React;
      
      // Ensure requestAnimationFrame is available for animations
      if (!window.requestAnimationFrame) {
        window.requestAnimationFrame = (callback) => {
          return setTimeout(callback, 16); // ~60fps fallback
        };
      }
      
      if (!window.cancelAnimationFrame) {
        window.cancelAnimationFrame = clearTimeout;
      }
      
      // Provide common animation utilities
      window.setTimeout = window.setTimeout;
      window.setInterval = window.setInterval;
      window.clearTimeout = window.clearTimeout;
      window.clearInterval = window.clearInterval;
      
      // Add performance.now for high-precision timing
      if (!window.performance) {
        window.performance = { now: () => Date.now() };
      }
      
      console.log('🦆 DuckPond Interactive Environment Ready');
      console.log('📦 Available React hooks:', {
        useState: !!useState,
        useEffect: !!useEffect,
        useRef: !!useRef,
        useCallback: !!useCallback,
        useMemo: !!useMemo,
        useReducer: !!useReducer
      });
      console.log('🎬 Animation APIs:', {
        requestAnimationFrame: !!window.requestAnimationFrame,
        performance: !!window.performance,
        setTimeout: !!window.setTimeout
      });
      
      ${content}
      
      // Enhanced component detection with better error handling
      const componentNames = Object.keys(window).filter(key => {
        try {
          return typeof window[key] === 'function' && 
                 key[0] === key[0].toUpperCase() &&
                 key !== 'Component' &&
                 key !== 'React' &&
                 key !== 'ReactDOM' &&
                 key !== 'Babel' &&
                 !key.startsWith('_');
        } catch (e) {
          return false;
        }
      });
      
      let Component = null;
      
      // Try to find the component with improved detection
      if (componentNames.length > 0) {
        // Prefer components with common animation/interactive names
        const interactiveNames = componentNames.filter(name => 
          /animation|interactive|bouncing|moving|game|demo|widget/i.test(name)
        );
        
        Component = window[interactiveNames[0]] || window[componentNames[0]];
      }
      
      console.log('🔍 Found component names:', componentNames);
      console.log('🎯 Selected component:', Component?.name || 'unnamed');
      
      if (Component && typeof Component === 'function') {
        // Wait a bit to ensure DOM is ready
        setTimeout(() => {
          const rootElement = document.getElementById('root');
          if (rootElement) {
            try {
              const root = ReactDOM.createRoot(rootElement);
              const element = React.createElement(Component);
              root.render(element);
              console.log('✅ Interactive component rendered successfully');
            } catch (renderError) {
              console.error('❌ Render error:', renderError);
              rootElement.innerHTML = 
                '<div class="error">Render error: ' + renderError.message + 
                '<br><br>💡 Tips for interactive components:' +
                '<br>• Use React.useState for state' +
                '<br>• Use React.useEffect for animations' +
                '<br>• Use React.useRef for DOM access' +
                '<br>• Export component with window.ComponentName = ComponentName' +
                '</div>';
            }
          }
        }, 50); // Small delay to ensure everything is ready
      } else {
        console.log('❌ No component found');
        const rootElement = document.getElementById('root');
        if (rootElement) {
          rootElement.innerHTML = 
            '<div class="error">' +
            '🦆 No React component detected<br><br>' +
            '📋 Available functions: ' + 
            Object.keys(window).filter(key => typeof window[key] === 'function').slice(0, 10).join(', ') +
            (Object.keys(window).filter(key => typeof window[key] === 'function').length > 10 ? '...' : '') +
            '<br><br>💡 Make sure to export your component:<br>' +
            '<code>window.YourComponentName = YourComponentName;</code>' +
            '</div>';
        }
      }
    } catch (error) {
      console.error('🚨 DuckPond execution error:', error);
      const rootElement = document.getElementById('root');
      if (rootElement) {
        rootElement.innerHTML = 
          '<div class="error">' +
          '🚨 Execution Error: ' + error.message +
          '<br><br>🔧 Debug info:' +
          '<br>• Check browser console for details' +
          '<br>• Ensure proper React syntax' +
          '<br>• Verify component export' +
          '</div>';
      }
    }
  </script>
</body>
</html>`;
}

function createJavaScriptSandbox(content: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>DuckPond JavaScript</title>
  <style>
    body { margin: 16px; font-family: system-ui, -apple-system, sans-serif; }
    .output { background: #f5f5f5; padding: 8px; border-radius: 4px; margin: 8px 0; }
    .error { color: red; background: #fee; padding: 8px; border-radius: 4px; margin: 8px 0; }
  </style>
</head>
<body>
  <div id="output"></div>
  <script>
    const output = document.getElementById('output');
    
    // Override console.log to capture output
    const originalLog = console.log;
    console.log = function(...args) {
      const div = document.createElement('div');
      div.className = 'output';
      div.textContent = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      output.appendChild(div);
      originalLog.apply(console, args);
    };
    
    try {
      ${content}
    } catch (error) {
      const div = document.createElement('div');
      div.className = 'error';
      div.textContent = 'Error: ' + error.message;
      output.appendChild(div);
      console.error('DuckPond execution error:', error);
    }
  </script>
</body>
</html>`;
}

function getFileExtension(type: string): string {
  const extensions: Record<string, string> = {
    'react-component': 'jsx',
    'html': 'html',
    'javascript': 'js',
    'css': 'css',
    'json': 'json',
  };
  
  return extensions[type] || 'txt';
}