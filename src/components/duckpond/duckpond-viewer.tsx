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
}

export function DuckPondViewer({
  artifact,
  className,
  onEdit,
  onExecute,
  initialTab = 'preview',
  enableFullscreen = true,
  hideHeader = false,
}: DuckPondViewerProps) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [execution, setExecution] = useState<ArtifactExecution>({
    artifactId: artifact.id,
    status: 'idle',
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const executeArtifact = useCallback(async () => {
    if (!iframeRef.current) return;

    const iframe = iframeRef.current;
    
    // Create sandbox HTML content
    const sandboxContent = createSandboxContent(artifact);
    
    // Write content to iframe
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(sandboxContent);
      doc.close();
    }
  }, [artifact]);

  const handleExecute = useCallback(async () => {
    if (execution.status === 'executing') return;

    setExecution(prev => ({ 
      ...prev, 
      status: 'executing',
      error: undefined // Clear any previous errors
    }));

    try {
      // Execute the artifact
      if (onExecute) {
        await onExecute(artifact);
      } else {
        await executeArtifact();
      }

      setExecution(prev => ({
        ...prev,
        status: 'success',
        lastExecuted: new Date(),
      }));
    } catch (error) {
      setExecution(prev => ({
        ...prev,
        status: 'error',
        error: error instanceof Error ? error.message : 'Execution failed',
      }));
    }
  }, [artifact, execution.status, onExecute, executeArtifact]);

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
    
    setExecution(prev => ({
      ...prev,
      status: 'stopped',
    }));
  }, []);

  const handleReset = useCallback(() => {
    if (!iframeRef.current) return;
    
    // Reset iframe to blank state
    const iframe = iframeRef.current;
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(`
        <html>
          <head><title>DuckPond - Ready</title></head>
          <body style="display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; font-family: system-ui, sans-serif; color: #666;">
            <div style="text-align: center;">
              <div style="font-size: 48px; margin-bottom: 16px;">🦆</div>
              <div>Ready to run</div>
              <div style="font-size: 12px; margin-top: 8px;">Click Run to execute</div>
            </div>
          </body>
        </html>
      `);
      doc.close();
    }
    
    setExecution(prev => ({
      ...prev,
      status: 'idle',
      error: undefined,
      lastExecuted: undefined,
    }));
  }, []);

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
    switch (execution.status) {
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
    switch (execution.status) {
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
    if (artifact.type === 'react-component' && execution.status === 'idle') {
      // Add a small delay to ensure iframe is ready
      const timeoutId = setTimeout(() => {
        handleExecute();
      }, 100);
      
      return () => clearTimeout(timeoutId);
    }
  }, [artifact.id, artifact.type, execution.status, handleExecute]);

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
                onClick={execution.status === 'executing' ? handleStop : handleExecute}
                disabled={false}
                className="rounded-r-none"
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
            
            {/* Status Indicator */}
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {getStatusIcon()}
              <span>
                {execution.status === 'executing' && 'Running...'}
                {execution.status === 'success' && 'Ready'}
                {execution.status === 'error' && 'Error'}
                {execution.status === 'stopped' && 'Stopped'}
                {execution.status === 'idle' && 'Ready'}
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
        
        {execution.error && (
          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            <div className="flex items-center gap-1">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-medium">Execution Error:</span>
            </div>
            <div className="mt-1">{execution.error}</div>
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
                className="w-full h-64 rounded-lg"
                title={`${artifact.title} Preview`}
                sandbox="allow-scripts allow-same-origin"
                style={{ minHeight: isFullscreen ? '60vh' : '16rem' }}
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
  <title>DuckPond React Component</title>
  <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <style>
    body { margin: 16px; font-family: system-ui, -apple-system, sans-serif; }
    .error { color: red; background: #fee; padding: 8px; border-radius: 4px; margin: 8px 0; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    try {
      const { useState, useEffect, useCallback, useMemo } = React;
      
      ${content}
      
      // Try to find and render the main component
      const componentNames = Object.keys(window).filter(key => 
        typeof window[key] === 'function' && 
        key[0] === key[0].toUpperCase() &&
        key !== 'Component' &&
        key !== 'React' &&
        key !== 'ReactDOM'
      );
      
      let Component = null;
      
      // First try to find a component by name
      if (componentNames.length > 0) {
        Component = window[componentNames[0]];
      }
      
      // If no component found, try to find any function that might be a component
      if (!Component) {
        for (const key of Object.keys(window)) {
          const value = window[key];
          if (typeof value === 'function' && 
              key[0] === key[0].toUpperCase() &&
              key !== 'Component' &&
              key !== 'React' &&
              key !== 'ReactDOM') {
            Component = value;
            break;
          }
        }
      }
      
      console.log('Available window properties:', Object.keys(window).filter(key => 
        typeof window[key] === 'function' && key[0] === key[0].toUpperCase()
      ));
      console.log('Found component names:', componentNames);
      console.log('Selected component:', Component);
      
      if (Component && typeof Component === 'function') {
        const root = ReactDOM.createRoot(document.getElementById('root'));
        try {
          const element = React.createElement(Component);
          root.render(element);
          console.log('Component rendered successfully');
        } catch (renderError) {
          console.error('Render error:', renderError);
          document.getElementById('root').innerHTML = 
            '<div class="error">Render error: ' + renderError.message + '</div>';
        }
      } else {
        console.log('No component found. Available functions:', 
          Object.keys(window).filter(key => typeof window[key] === 'function')
        );
        document.getElementById('root').innerHTML = 
          '<div class="error">No React component found. Available functions: ' + 
          Object.keys(window).filter(key => typeof window[key] === 'function').join(', ') +
          '</div>';
      }
    } catch (error) {
      document.getElementById('root').innerHTML = 
        '<div class="error">Error: ' + error.message + '</div>';
      console.error('DuckPond execution error:', error);
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