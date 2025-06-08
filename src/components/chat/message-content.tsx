"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useTheme } from "next-themes";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface MessageContentProps {
  content: string;
}

export function MessageContent({ content }: MessageContentProps) {
  const { theme } = useTheme();
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCode(text);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  return (
    <div className="prose prose-sm max-w-none dark:prose-invert">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            const codeString = String(children).replace(/\n$/, "");
            
            if (!inline && match) {
              return (
                <div className="relative group">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => copyToClipboard(codeString)}
                  >
                    {copiedCode === codeString ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                  <SyntaxHighlighter
                    style={theme === "dark" ? oneDark : oneLight}
                    language={match[1]}
                    PreTag="div"
                    {...props}
                  >
                    {codeString}
                  </SyntaxHighlighter>
                </div>
              );
            }
            
            return (
              <code className="bg-muted px-1 py-0.5 rounded text-sm" {...props}>
                {children}
              </code>
            );
          },
          pre({ children }) {
            return <div className="overflow-x-auto">{children}</div>;
          },
          blockquote({ children }) {
            return (
              <blockquote className="border-l-4 border-primary pl-4 italic">
                {children}
              </blockquote>
            );
          },
          table({ children }) {
            return (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse border border-border">
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
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}