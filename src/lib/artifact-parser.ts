import { 
  ArtifactDetectionResult, 
  ParsedArtifact, 
  ArtifactType 
} from '@/types/artifact';
import { logger } from '@/lib/logger';

export class ArtifactParser {
  /**
   * Detects and parses artifacts from LLM response content
   */
  static parseContent(content: string): ArtifactDetectionResult {
    const artifacts: ParsedArtifact[] = [];
    let cleanedContent = content;

    // Debug logging
    logger.dev.log('ArtifactParser.parseContent called with content length:', content.length);
    logger.dev.log('Content preview:', content.substring(0, 200));

    // Check for DuckPond artifacts
    const duckpondArtifacts = this.extractDuckPondArtifacts(content);
    artifacts.push(...duckpondArtifacts.artifacts);
    cleanedContent = duckpondArtifacts.cleanedContent;

    // Check for React component artifacts
    const reactArtifacts = this.extractReactArtifacts(cleanedContent);
    artifacts.push(...reactArtifacts.artifacts);
    cleanedContent = reactArtifacts.cleanedContent;

    // Check for HTML artifacts
    const htmlArtifacts = this.extractHtmlArtifacts(cleanedContent);
    artifacts.push(...htmlArtifacts.artifacts);
    cleanedContent = htmlArtifacts.cleanedContent;

    // Check for Circuit artifacts
    const circuitArtifacts = this.extractCircuitArtifacts(cleanedContent);
    artifacts.push(...circuitArtifacts.artifacts);
    cleanedContent = circuitArtifacts.cleanedContent;

    logger.dev.log('ArtifactParser found artifacts:', artifacts.length);
    artifacts.forEach(a => logger.dev.log('- Artifact:', a.type, a.title));

    return {
      hasArtifacts: artifacts.length > 0,
      artifacts,
      cleanedContent: cleanedContent.trim(),
    };
  }

  /**
   * Extract DuckPond artifacts using <duckpond> tags
   */
  private static extractDuckPondArtifacts(content: string): ArtifactDetectionResult {
    const artifacts: ParsedArtifact[] = [];
    let cleanedContent = content;

    // Regex to match <duckpond type="..." title="..." description="...">content</duckpond>
    const duckpondRegex = /<duckpond\s+([^>]*?)>([\s\S]*?)<\/duckpond>/gi;
    let match;

    while ((match = duckpondRegex.exec(content)) !== null) {
      const attributesStr = match[1];
      const artifactContent = match[2].trim();
      
      // Parse attributes
      const attributes = this.parseAttributes(attributesStr);
      const type = (attributes.type as ArtifactType) || 'react-component';
      const title = attributes.title || `Untitled ${type}`;
      const description = attributes.description;

      artifacts.push({
        type,
        title,
        description,
        content: artifactContent,
        metadata: {
          dependencies: attributes.dependencies ? attributes.dependencies.split(',').map(d => d.trim()) : [],
          props: attributes.props ? JSON.parse(attributes.props) : undefined,
        },
      });

      // Replace with placeholder
      const placeholder = `\n\n**🦆 DuckPond Artifact: ${title}**\n*${description || `Interactive ${type} component`}*\n\n`;
      cleanedContent = cleanedContent.replace(match[0], placeholder);
    }

    return {
      hasArtifacts: artifacts.length > 0,
      artifacts,
      cleanedContent,
    };
  }

  /**
   * Extract React component artifacts using <react-component> tags
   */
  private static extractReactArtifacts(content: string): ArtifactDetectionResult {
    const artifacts: ParsedArtifact[] = [];
    let cleanedContent = content;

    const reactRegex = /<react-component\s+([^>]*?)>([\s\S]*?)<\/react-component>/gi;
    let match;

    while ((match = reactRegex.exec(content)) !== null) {
      const attributesStr = match[1];
      const artifactContent = match[2].trim();
      
      const attributes = this.parseAttributes(attributesStr);
      const title = attributes.title || 'React Component';
      const description = attributes.description;

      artifacts.push({
        type: 'react-component',
        title,
        description,
        content: artifactContent,
        metadata: {
          dependencies: attributes.dependencies ? attributes.dependencies.split(',').map(d => d.trim()) : ['react'],
        },
      });

      // Replace with placeholder
      const placeholder = `\n\n**🦆 DuckPond Artifact: ${title}**\n*${description || `Interactive react-component`}*\n\n`;
      cleanedContent = cleanedContent.replace(match[0], placeholder);
    }

    return {
      hasArtifacts: artifacts.length > 0,
      artifacts,
      cleanedContent,
    };
  }

  /**
   * Extract HTML artifacts using <html-artifact> tags
   */
  private static extractHtmlArtifacts(content: string): ArtifactDetectionResult {
    const artifacts: ParsedArtifact[] = [];
    let cleanedContent = content;

    const htmlRegex = /<html-artifact\s+([^>]*?)>([\s\S]*?)<\/html-artifact>/gi;
    let match;

    while ((match = htmlRegex.exec(content)) !== null) {
      const attributesStr = match[1];
      const artifactContent = match[2].trim();
      
      const attributes = this.parseAttributes(attributesStr);
      const title = attributes.title || 'HTML Artifact';
      const description = attributes.description;

      artifacts.push({
        type: 'html',
        title,
        description,
        content: artifactContent,
      });

      // Replace with placeholder
      const placeholder = `\n\n**🦆 DuckPond Artifact: ${title}**\n*${description || `Interactive html component`}*\n\n`;
      cleanedContent = cleanedContent.replace(match[0], placeholder);
    }

    return {
      hasArtifacts: artifacts.length > 0,
      artifacts,
      cleanedContent,
    };
  }

  /**
   * Extract Circuit artifacts using <circuit> or <circuitjs> tags
   */
  private static extractCircuitArtifacts(content: string): ArtifactDetectionResult {
    const artifacts: ParsedArtifact[] = [];
    let cleanedContent = content;

    // Regex to match both <circuit> and <circuitjs> tags
    const circuitRegex = /<(circuit|circuitjs)\s+([^>]*?)>([\s\S]*?)<\/\1>/gi;
    let match;

    while ((match = circuitRegex.exec(content)) !== null) {
      const tagName = match[1]; // 'circuit' or 'circuitjs'
      const attributesStr = match[2];
      const artifactContent = match[3].trim();
      
      // Parse attributes
      const attributes = this.parseAttributes(attributesStr);
      const title = attributes.title || `CircuitJS1 ${tagName === 'circuit' ? 'Circuit' : 'Simulation'}`;
      const description = attributes.description || `Interactive electronic circuit simulation`;

      // Validate circuit content (basic netlist format check)
      if (this.isValidNetlist(artifactContent)) {
        artifacts.push({
          type: 'circuit',
          title,
          description,
          content: artifactContent,
          metadata: {
            circuitType: tagName,
            // Parse additional metadata if needed
          },
        });

        // Replace with placeholder
        const placeholder = `\n\n**🦆 DuckPond Artifact: ${title}**\n*${description}*\n\n`;
        cleanedContent = cleanedContent.replace(match[0], placeholder);
      } else {
        logger.dev.log('Invalid circuit netlist format detected, skipping:', artifactContent.substring(0, 100));
      }
    }

    return {
      hasArtifacts: artifacts.length > 0,
      artifacts,
      cleanedContent,
    };
  }

  /**
   * Basic validation for CircuitJS1 netlist format
   */
  private static isValidNetlist(content: string): boolean {
    if (!content || content.trim().length === 0) {
      return false;
    }

    const lines = content.trim().split('\n');
    
    // Check if first line starts with $ (CircuitJS1 simulation parameters)
    if (lines.length > 0 && lines[0].trim().startsWith('$')) {
      return true;
    }

    // Also accept netlists without $ line (component-only)
    // Check if content contains typical component codes
    const componentCodes = /^[a-zA-Z0-9]+\s+\d+\s+\d+\s+\d+\s+\d+/m;
    return componentCodes.test(content);
  }

  /**
   * Parse XML-like attributes from a string
   */
  private static parseAttributes(attributesStr: string): Record<string, string> {
    const attributes: Record<string, string> = {};
    
    // Match attribute="value" or attribute='value'
    const attrRegex = /(\w+)=["']([^"']*)["']/g;
    let match;

    while ((match = attrRegex.exec(attributesStr)) !== null) {
      attributes[match[1]] = match[2];
    }

    return attributes;
  }

  /**
   * Validate artifact content for security and syntax
   */
  static validateArtifact(artifact: ParsedArtifact): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Basic validation
    if (!artifact.content || artifact.content.trim().length === 0) {
      errors.push('Artifact content cannot be empty');
    }

    if (!artifact.title || artifact.title.trim().length === 0) {
      errors.push('Artifact title is required');
    }

    // Type-specific validation
    switch (artifact.type) {
      case 'react-component':
        this.validateReactComponent(artifact.content, errors);
        break;
      case 'html':
        this.validateHtml(artifact.content, errors);
        break;
      case 'javascript':
        this.validateJavaScript(artifact.content, errors);
        break;
      case 'circuit':
        this.validateCircuit(artifact.content, errors);
        break;
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private static validateReactComponent(content: string, errors: string[]): void {
    // Check for dangerous patterns
    const dangerousPatterns = [
      /eval\s*\(/,
      /Function\s*\(/,
      /document\.write/,
      /innerHTML\s*=/,
      /dangerouslySetInnerHTML/,
      /import\s+.*from\s+["']https?:/,
      /require\s*\(\s*["']https?:/,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(content)) {
        errors.push(`Potentially unsafe code detected: ${pattern.source}`);
      }
    }

    // Check for basic React syntax
    if (!content.includes('function') && !content.includes('=>') && !content.includes('const')) {
      errors.push('React component should contain a function or component definition');
    }
  }

  private static validateHtml(content: string, errors: string[]): void {
    // Check for dangerous HTML patterns
    const dangerousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i, // onclick, onload, etc.
      /<iframe/i,
      /<object/i,
      /<embed/i,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(content)) {
        errors.push(`Potentially unsafe HTML detected: ${pattern.source}`);
      }
    }
  }

  private static validateJavaScript(content: string, errors: string[]): void {
    // Check for dangerous JS patterns
    const dangerousPatterns = [
      /eval\s*\(/,
      /Function\s*\(/,
      /document\.write/,
      /window\.open/,
      /location\.(href|replace)/,
      /XMLHttpRequest/,
      /fetch\s*\(/,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(content)) {
        errors.push(`Potentially unsafe JavaScript detected: ${pattern.source}`);
      }
    }
  }

  private static validateCircuit(content: string, errors: string[]): void {
    // Validate circuit netlist format
    if (!this.isValidNetlist(content)) {
      errors.push('Invalid circuit netlist format');
    }

    // Check for reasonable content length
    if (content.length > 50000) {
      errors.push('Circuit netlist too large (>50KB)');
    }

    // Basic security check - circuit netlists should only contain printable ASCII
    const nonPrintableRegex = /[^\x20-\x7E\n\r\t]/;
    if (nonPrintableRegex.test(content)) {
      errors.push('Circuit netlist contains non-printable characters');
    }

    // Check for excessive number of components (performance limit)
    const lines = content.split('\n').filter(line => line.trim() && !line.trim().startsWith('$') && !line.trim().startsWith('#'));
    if (lines.length > 1000) {
      errors.push('Circuit has too many components (>1000)');
    }
  }

  /**
   * Generate a file name for an artifact
   */
  static generateFileName(artifact: ParsedArtifact): string {
    const sanitizedTitle = artifact.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50);

    const timestamp = Date.now();
    
    switch (artifact.type) {
      case 'react-component':
        return `${sanitizedTitle}-${timestamp}.jsx`;
      case 'html':
        return `${sanitizedTitle}-${timestamp}.html`;
      case 'javascript':
        return `${sanitizedTitle}-${timestamp}.js`;
      case 'css':
        return `${sanitizedTitle}-${timestamp}.css`;
      case 'json':
        return `${sanitizedTitle}-${timestamp}.json`;
      case 'circuit':
        return `${sanitizedTitle}-${timestamp}.txt`;
      default:
        return `${sanitizedTitle}-${timestamp}.artifact`;
    }
  }

  /**
   * Get MIME type for artifact type
   */
  static getMimeType(type: ArtifactType): string {
    switch (type) {
      case 'react-component':
        return 'text/x-react-component';
      case 'html':
        return 'text/html';
      case 'javascript':
        return 'text/javascript';
      case 'css':
        return 'text/css';
      case 'json':
        return 'application/json';
      case 'circuit':
        return 'text/plain';
      default:
        return 'text/x-duckpond-artifact';
    }
  }
}