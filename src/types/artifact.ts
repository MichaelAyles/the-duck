export type ArtifactType = 'react-component' | 'html' | 'javascript' | 'css' | 'json';

export interface Artifact {
  id: string;
  type: ArtifactType;
  title: string;
  description?: string;
  content: string;
  fileId?: string; // Links to file_uploads table
  messageId?: string;
  sessionId?: string;
  version: number;
  metadata?: {
    dependencies?: string[];
    props?: Record<string, unknown>;
    exports?: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface ArtifactDetectionResult {
  hasArtifacts: boolean;
  artifacts: ParsedArtifact[];
  cleanedContent: string; // Content with artifact tags removed
}

export interface ParsedArtifact {
  type: ArtifactType;
  title: string;
  description?: string;
  content: string;
  metadata?: Artifact['metadata'];
}

export interface ArtifactExecution {
  artifactId: string;
  status: 'idle' | 'executing' | 'success' | 'error' | 'stopped';
  error?: string;
  lastExecuted?: Date;
}

// DuckPond-specific types
export interface DuckPondConfig {
  allowedImports: string[];
  maxExecutionTime: number;
  enableHotReload: boolean;
  sandboxMode: 'strict' | 'loose';
}

export interface ComponentBundle {
  code: string;
  dependencies: Record<string, string>;
  sourceMap?: string;
}

// Message integration types
export interface ArtifactMessage {
  artifacts: Artifact[];
  hasInteractiveContent: boolean;
}

// Artifact file operations
export interface ArtifactFileUpload {
  artifact: ParsedArtifact;
  userId: string;
  sessionId?: string;
  messageId?: string;
}

export interface ArtifactSaveResult {
  success: boolean;
  artifactId?: string;
  fileId?: string;
  url?: string;
  error?: string;
}

// Constants
export const ARTIFACT_MARKERS = {
  DUCKPOND: {
    start: '<duckpond',
    end: '</duckpond>',
  },
  REACT: {
    start: '<react-component',
    end: '</react-component>',
  },
  HTML: {
    start: '<html-artifact',
    end: '</html-artifact>',
  },
} as const;

export const DEFAULT_DUCKPOND_CONFIG: DuckPondConfig = {
  allowedImports: [
    'react',
    'react-dom',
    'lucide-react',
    'tailwindcss',
    'd3',
    'chart.js',
    'plotly.js',
  ],
  maxExecutionTime: 5000, // 5 seconds
  enableHotReload: true,
  sandboxMode: 'strict',
};