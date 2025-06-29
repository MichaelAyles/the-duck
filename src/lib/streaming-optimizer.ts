/**
 * 🚀 Streaming Utilities
 * 
 * Basic streaming utilities for chat responses
 */

import { logger } from '@/lib/logger';

interface StreamingConfig {
  chunkSize: number;
  timeoutMs: number;
}

interface StreamMetrics {
  startTime: number;
  bytesTransferred: number;
  chunksProcessed: number;
}

// Simple streaming configuration
const DEFAULT_STREAMING_CONFIG: StreamingConfig = {
  chunkSize: 512, // Optimal chunk size for low latency
  timeoutMs: 30000, // 30 second timeout
};

export class StreamingOptimizer {
  private config: StreamingConfig;
  private activeStreams: Map<string, StreamMetrics> = new Map();

  constructor(config?: Partial<StreamingConfig>) {
    this.config = { ...DEFAULT_STREAMING_CONFIG, ...config };
  }

  /**
   * Create a basic streaming response for chat
   */
  async createOptimizedStream(
    asyncIterator: AsyncIterableIterator<string>,
    streamId: string = crypto.randomUUID()
  ): Promise<ReadableStream<Uint8Array>> {
    const metrics: StreamMetrics = {
      startTime: performance.now(),
      bytesTransferred: 0,
      chunksProcessed: 0,
    };

    this.activeStreams.set(streamId, metrics);
    
    return new ReadableStream({
      start: async (controller) => {
        const encoder = new TextEncoder();
        let buffer = '';

        try {
          for await (const chunk of asyncIterator) {
            // Add chunk to buffer
            buffer += chunk;
            metrics.chunksProcessed++;

            // Process buffer when it reaches optimal size or stream ends
            if (buffer.length >= this.config.chunkSize) {
              await this.processBuffer(controller, encoder, buffer, metrics);
              buffer = '';
            }

            // Yield control to prevent blocking
            await new Promise(resolve => setTimeout(resolve, 0));
          }

          // Process remaining buffer
          if (buffer.length > 0) {
            await this.processBuffer(controller, encoder, buffer, metrics);
          }

          controller.close();
        } catch (error) {
          logger.error('Streaming error:', error);
          
          controller.enqueue(encoder.encode(`\n\ndata: ${JSON.stringify({ 
            type: 'error',
            error: 'Stream processing failed' 
          })}\n\n`));
          
          controller.error(error);
        } finally {
          this.activeStreams.delete(streamId);
        }
      },

      cancel: () => {
        this.activeStreams.delete(streamId);
      }
    });
  }

  /**
   * Process buffer with basic chunking
   */
  private async processBuffer(
    controller: ReadableStreamDefaultController,
    encoder: TextEncoder,
    content: string,
    metrics: StreamMetrics
  ): Promise<void> {
    try {
      // Format as Server-Sent Events
      const formattedChunk = `data: ${JSON.stringify({ 
        type: 'content',
        content: content,
        timestamp: Date.now()
      })}\n\n`;

      const encodedChunk = encoder.encode(formattedChunk);
      metrics.bytesTransferred += encodedChunk.length;

      controller.enqueue(encodedChunk);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get basic streaming statistics
   */
  getStreamingStats(): {
    activeStreams: number;
    totalBytesTransferred: number;
  } {
    const streams = Array.from(this.activeStreams.values());
    
    if (streams.length === 0) {
      return {
        activeStreams: 0,
        totalBytesTransferred: 0,
      };
    }

    const totalBytes = streams.reduce((sum, stream) => sum + stream.bytesTransferred, 0);

    return {
      activeStreams: streams.length,
      totalBytesTransferred: totalBytes,
    };
  }
}

// Streaming utilities for common patterns
export const StreamingUtils = {
  /**
   * Create a throttled stream that limits emission rate
   */
  throttleStream<T>(
    stream: ReadableStream<T>, 
    intervalMs: number
  ): ReadableStream<T> {
    return new ReadableStream({
      async start(controller) {
        const reader = stream.getReader();
        let lastEmit = 0;

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const now = performance.now();
            const elapsed = now - lastEmit;

            if (elapsed < intervalMs) {
              await new Promise(resolve => setTimeout(resolve, intervalMs - elapsed));
            }

            controller.enqueue(value);
            lastEmit = performance.now();
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        } finally {
          reader.releaseLock();
        }
      }
    });
  },

  /**
   * Create a buffered stream that batches items
   */
  bufferStream<T>(
    stream: ReadableStream<T>,
    bufferSize: number,
    timeoutMs: number = 100
  ): ReadableStream<T[]> {
    return new ReadableStream({
      async start(controller) {
        const reader = stream.getReader();
        let buffer: T[] = [];
        let timeoutId: NodeJS.Timeout | undefined;

        const flushBuffer = () => {
          if (buffer.length > 0) {
            controller.enqueue([...buffer]);
            buffer = [];
          }
          if (timeoutId) clearTimeout(timeoutId);
        };

        const scheduleFlush = () => {
          if (timeoutId) clearTimeout(timeoutId);
          timeoutId = setTimeout(flushBuffer, timeoutMs);
        };

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer.push(value);

            if (buffer.length >= bufferSize) {
              flushBuffer();
            } else {
              scheduleFlush();
            }
          }

          flushBuffer();
          controller.close();
        } catch (error) {
          controller.error(error);
        } finally {
          reader.releaseLock();
          if (timeoutId) clearTimeout(timeoutId);
        }
      }
    });
  }
};

// Global streaming optimizer instance
export const streamingOptimizer = new StreamingOptimizer(); 