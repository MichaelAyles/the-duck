"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useTheme } from "next-themes";
import { Copy, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import React, { useState, Suspense } from "react";
import dynamic from "next/dynamic";
import { Message } from "@/types/chat";
import { useArtifacts } from "@/hooks/use-artifacts";
import { useArtifactPanel } from "@/contexts/artifact-panel-context";
import { Play, Code2 } from "lucide-react";

interface MessageContentProps {
  content: string;
  message?: Message;
  userId?: string;
  sessionId?: string;
}

// Lazy load syntax highlighter to reduce initial bundle size
const SyntaxHighlighter = dynamic(
  () => import("react-syntax-highlighter").then((mod) => mod.Prism),
  {
    loading: () => (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="ml-2 text-sm text-muted-foreground">Loading syntax highlighter...</span>
      </div>
    ),
    ssr: false, // Disable SSR for this component to reduce server bundle
  }
);

// Lazy load syntax highlighting styles
const loadSyntaxStyles = async (theme: string) => {
  if (theme === "dark") {
    const { oneDark } = await import("react-syntax-highlighter/dist/esm/styles/prism");
    return oneDark;
  } else {
    const { oneLight } = await import("react-syntax-highlighter/dist/esm/styles/prism");
    return oneLight;
  }
};

interface CodeBlockProps {
  language: string;
  code: string;
  theme: string;
  onCopy: (text: string) => void;
  isCopied: boolean;
}

// Memoized code block component to prevent unnecessary re-renders
const CodeBlock = React.memo(({ language, code, theme, onCopy, isCopied }: CodeBlockProps) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [syntaxStyle, setSyntaxStyle] = useState<any>(null);

  React.useEffect(() => {
    loadSyntaxStyles(theme).then(setSyntaxStyle);
  }, [theme]);

  if (!syntaxStyle) {
    return (
      <div className="bg-muted rounded-md p-4">
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="ml-2 text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative group">
      <Button
        variant="ghost"
        size="sm"
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10"
        onClick={() => onCopy(code)}
      >
        {isCopied ? (
          <Check className="h-4 w-4" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </Button>
      <SyntaxHighlighter
        style={syntaxStyle}
        language={language}
        PreTag="div"
        customStyle={{
          margin: 0,
          borderRadius: '0.375rem',
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
});

CodeBlock.displayName = 'CodeBlock';

export function MessageContent({ content, message, userId, sessionId }: MessageContentProps) {
  const { theme } = useTheme();
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const { getArtifactsFromMessage, loadArtifact } = useArtifacts({ userId, sessionId });
  const { openArtifact } = useArtifactPanel();

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCode(text);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  // Get artifacts from message if available
  const artifacts = message ? getArtifactsFromMessage(message) : [];
  
  // Debug logging for artifact rendering
  if (process.env.NODE_ENV === 'development' && message) {
    console.log(`MessageContent for message ${message.id}:`, {
      hasMessage: !!message,
      messageArtifacts: message.artifacts,
      processedArtifacts: artifacts,
      artifactCount: artifacts.length
    });
  }

  const handleOpenArtifact = async (artifactId: string) => {
    const artifact = await loadArtifact(artifactId);
    if (artifact) {
      openArtifact(artifact);
    }
  };

  return (
    <div className="space-y-4">
      {/* Render markdown content */}
      <div className="prose prose-sm max-w-none dark:prose-invert">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code(props) {
            const { className, children } = props;
            const match = /language-(\w+)/.exec(className || "");
            const codeString = String(children).replace(/\n$/, "");
            const isInline = !match;
            
            if (!isInline && match) {
              return (
                <Suspense fallback={
                  <div className="bg-muted rounded-md p-4">
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="ml-2 text-sm">Loading code block...</span>
                    </div>
                  </div>
                }>
                  <CodeBlock
                    language={match[1]}
                    code={codeString}
                    theme={theme || 'light'}
                    onCopy={copyToClipboard}
                    isCopied={copiedCode === codeString}
                  />
                </Suspense>
              );
            }
            
            return (
              <code className="bg-muted px-1 py-0.5 rounded text-sm font-mono">
                {children}
              </code>
            );
          },
          pre({ children }) {
            return <div className="overflow-x-auto">{children}</div>;
          },
          blockquote({ children }) {
            return (
              <blockquote className="border-l-4 border-primary pl-4 italic my-4">
                {children}
              </blockquote>
            );
          },
          table({ children }) {
            return (
              <div className="overflow-x-auto my-4">
                <table className="min-w-full border-collapse border border-border rounded-md">
                  {children}
                </table>
              </div>
            );
          },
          th({ children }) {
            return (
              <th className="border border-border bg-muted px-4 py-2 text-left font-semibold">
                {children}
              </th>
            );
          },
          td({ children }) {
            return (
              <td className="border border-border px-4 py-2">
                {children}
              </td>
            );
          },
          // Optimize list rendering
          ul({ children }) {
            return <ul className="my-2 ml-6 list-disc">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="my-2 ml-6 list-decimal">{children}</ol>;
          },
          li({ children }) {
            return <li className="py-1">{children}</li>;
          },
          // Optimize heading rendering
          h1({ children }) {
            return <h1 className="text-2xl font-bold my-4">{children}</h1>;
          },
          h2({ children }) {
            return <h2 className="text-xl font-semibold my-3">{children}</h2>;
          },
          h3({ children }) {
            return <h3 className="text-lg font-medium my-2">{children}</h3>;
          },
          // Optimize paragraph rendering
          p({ children }) {
            return <p className="my-2 leading-relaxed">{children}</p>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
      </div>
      
      {/* Render artifact buttons */}
      {artifacts.length > 0 && (
        <div className="space-y-3 not-prose">
          {artifacts.map((artifactRef) => (
            <div
              key={artifactRef.id}
              className="border rounded-lg p-4 bg-muted/50 border-dashed"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-md">
                    <Code2 className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-medium text-sm">{artifactRef.title}</h4>
                    <p className="text-xs text-muted-foreground">
                      {artifactRef.description || `Interactive ${artifactRef.type} component`}
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => handleOpenArtifact(artifactRef.id)}
                  size="sm"
                  className="gap-2"
                >
                  <Play className="h-3 w-3" />
                  Run in DuckPond
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}