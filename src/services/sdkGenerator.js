/**
 * SDK Generator Service
 * Generates TypeScript SDKs for the MongoDB CRUD API
 */

const fs = require('fs').promises;
const path = require('path');

class SDKGeneratorService {
  constructor(schemaDiscovery, openApiGenerator) {
    this.schemaDiscovery = schemaDiscovery;
    this.openApiGenerator = openApiGenerator;
  }

  /**
   * Generate complete TypeScript SDK
   */
  async generateTypeScriptSDK(options = {}) {
    const {
      outputDir = './generated-sdk',
      packageName = '@your-org/mongodb-crud-sdk',
      apiUrl = 'http://localhost:3001'
    } = options;

    try {
      const collections = await this.schemaDiscovery.dbService.listCollections();
      const schemas = await this.schemaDiscovery.getAllCollectionSchemas();

      // Create output directory
      await fs.mkdir(outputDir, { recursive: true });

      // Generate all SDK files
      await this.generatePackageJson(outputDir, packageName);
      await this.generateTypes(outputDir, schemas);
      await this.generateBaseClient(outputDir, apiUrl);
      await this.generateCollectionClients(outputDir, collections, schemas);
      await this.generateWebhookClient(outputDir);
      await this.generateMainSDK(outputDir, collections);
      await this.generateIndex(outputDir, collections);
      await this.generateSDKReadme(outputDir, packageName, collections);
      await this.generateTSConfig(outputDir);

      return {
        success: true,
        outputDir,
        files: await this.getGeneratedFiles(outputDir),
        collections: collections.map(c => c.name)
      };
    } catch (error) {
      console.error('SDK generation failed:', error);
      throw error;
    }
  }

  /**
   * Generate TypeScript type definitions
   */
  async generateTypes(outputDir, schemas) {
    let typeDefinitions = `// Auto-generated TypeScript types for MongoDB CRUD API
// Generated on: ${new Date().toISOString()}

`;
    
    // Common interfaces
    typeDefinitions += `export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  filter?: Record<string, any>;
}

export interface FilterOptions {
  page?: number;
  limit?: number;
  sort?: string;
  fields?: string;
  filter?: Record<string, any>;
  [key: string]: any;
}

export interface WebhookConfig {
  _id?: string;
  name: string;
  url: string;
  collection: string;
  events: ('create' | 'update' | 'delete')[];
  filters?: Record<string, any>;
  enabled?: boolean;
  rateLimit?: {
    maxRequestsPerMinute?: number;
    maxRetries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface WebhookStats {
  deliveryStatistics: {
    delivered: number;
    failed: number;
    rateLimited: number;
    retryQueueSize: number;
    successRate: string;
    totalAttempts: number;
  };
  rateLimit: {
    maxRequestsPerMinute: number;
    windowMs: number;
    maxRetries: number;
    baseDelayMs: number;
    maxDelayMs: number;
  };
  systemHealth: {
    databaseConnected: boolean;
    webhookDeliveryActive: boolean;
    retryProcessorRunning: boolean;
  };
}

export interface CollectionInfo {
  name: string;
  type: string;
  options: Record<string, any>;
  info: {
    readOnly: boolean;
    uuid?: string;
  };
  idIndex: Record<string, any>;
}

export interface HealthStatus {
  success: boolean;
  status: string;
  timestamp: string;
  mongodb: {
    connected: boolean;
    collections: number;
  };
}

`;

    // Generate interface for each collection
    for (const [collectionName, schema] of Object.entries(schemas)) {
      const interfaceName = this.toTitleCase(collectionName);
      typeDefinitions += `export interface ${interfaceName} {\n`;
      
      if (schema.properties) {
        for (const [fieldName, fieldSchema] of Object.entries(schema.properties)) {
          const isRequired = schema.required?.includes(fieldName) ?? false;
          const optional = isRequired ? '' : '?';
          const type = this.mapSchemaToTypeScript(fieldSchema);
          const description = fieldSchema.description ? ` // ${fieldSchema.description}` : '';
          typeDefinitions += `  ${fieldName}${optional}: ${type};${description}\n`;
        }
      }
      
      typeDefinitions += `  [key: string]: any; // Additional properties allowed\n`;
      typeDefinitions += `}\n\n`;
    }

    await fs.writeFile(path.join(outputDir, 'types.ts'), typeDefinitions);
  }

  /**
   * Generate base client class
   */
  async generateBaseClient(outputDir, apiUrl) {
    const baseClientCode = `import { ApiResponse } from './types';

export class BaseClient {
  protected apiUrl: string;
  protected authToken?: string;

  constructor(apiUrl: string = '${apiUrl}', authToken?: string) {
    this.apiUrl = apiUrl.replace(/\\/$/, ''); // Remove trailing slash
    this.authToken = authToken;
  }

  /**
   * Make HTTP request to API
   */
  protected async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = \`\${this.apiUrl}\${endpoint}\`;
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (this.authToken) {
      headers.Authorization = \`Bearer \${this.authToken}\`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      const contentType = response.headers.get('content-type');
      let responseData: any;

      if (contentType && contentType.includes('application/json')) {
        responseData = await response.json();
      } else {
        responseData = { success: response.ok };
      }

      if (!response.ok) {
        const errorMessage = responseData?.error || responseData?.message || \`HTTP \${response.status}: \${response.statusText}\`;
        throw new Error(errorMessage);
      }

      return responseData as T;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(\`Request failed: \${error}\`);
    }
  }

  /**
   * Set authentication token
   */
  setAuthToken(token: string): void {
    this.authToken = token;
  }

  /**
   * Clear authentication token
   */
  clearAuthToken(): void {
    this.authToken = undefined;
  }

  /**
   * Get current API URL
   */
  getApiUrl(): string {
    return this.apiUrl;
  }

  /**
   * Update API URL
   */
  setApiUrl(url: string): void {
    this.apiUrl = url.replace(/\\/$/, '');
  }
}
`;

    await fs.writeFile(path.join(outputDir, 'base-client.ts'), baseClientCode);
  }

  /**
   * Generate collection-specific client classes
   */
  async generateCollectionClients(outputDir, collections, schemas) {
    for (const collection of collections) {
      const className = `${this.toTitleCase(collection.name)}Client`;
      const interfaceName = this.toTitleCase(collection.name);
      
      const clientCode = `import { ${interfaceName}, ApiResponse, PaginatedResponse, FilterOptions } from './types';
import { BaseClient } from './base-client';

export class ${className} extends BaseClient {
  private readonly collectionName = '${collection.name}';

  /**
   * List ${collection.name} documents with optional filtering and pagination
   */
  async list(options: FilterOptions = {}): Promise<PaginatedResponse<${interfaceName}>> {
    const params = new URLSearchParams();
    
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
      }
    });

    const queryString = params.toString();
    const endpoint = \`/api/db/\${this.collectionName}\${queryString ? \`?\${queryString}\` : ''}\`;
    
    return this.request<PaginatedResponse<${interfaceName}>>(endpoint);
  }

  /**
   * Get a specific ${collection.name} document by ID
   */
  async get(id: string): Promise<${interfaceName}> {
    const response = await this.request<ApiResponse<${interfaceName}>>(\`/api/db/\${this.collectionName}/\${id}\`);
    return response.data!;
  }

  /**
   * Create a new ${collection.name} document
   */
  async create(document: Omit<${interfaceName}, '_id'>): Promise<${interfaceName}> {
    const response = await this.request<ApiResponse<${interfaceName}>>(\`/api/db/\${this.collectionName}\`, {
      method: 'POST',
      body: JSON.stringify(document)
    });
    return response.data!;
  }

  /**
   * Update an existing ${collection.name} document
   */
  async update(id: string, document: Partial<${interfaceName}>): Promise<${interfaceName}> {
    const response = await this.request<ApiResponse<${interfaceName}>>(\`/api/db/\${this.collectionName}/\${id}\`, {
      method: 'PUT',
      body: JSON.stringify(document)
    });
    return response.data!;
  }

  /**
   * Delete a ${collection.name} document
   */
  async delete(id: string): Promise<void> {
    await this.request(\`/api/db/\${this.collectionName}/\${id}\`, {
      method: 'DELETE'
    });
  }

  /**
   * Advanced filtering with MongoDB-style queries
   */
  async query(filter: Record<string, any>, options: Omit<FilterOptions, 'filter'> = {}): Promise<PaginatedResponse<${interfaceName}>> {
    return this.list({ ...options, filter });
  }

  /**
   * Bulk create multiple documents
   */
  async bulkCreate(documents: Omit<${interfaceName}, '_id'>[]): Promise<${interfaceName}[]> {
    const results = await Promise.all(
      documents.map(doc => this.create(doc))
    );
    return results;
  }

  /**
   * Count documents matching filter
   */
  async count(filter: Record<string, any> = {}): Promise<number> {
    const response = await this.list({ filter, limit: 1 });
    return response.pagination.total;
  }

  /**
   * Check if document exists
   */
  async exists(id: string): Promise<boolean> {
    try {
      await this.get(id);
      return true;
    } catch {
      return false;
    }
  }
}
`;

      await fs.writeFile(path.join(outputDir, `${collection.name}-client.ts`), clientCode);
    }
  }

  /**
   * Generate webhook management client
   */
  async generateWebhookClient(outputDir) {
    const webhookClientCode = `import { WebhookConfig, WebhookStats, ApiResponse } from './types';
import { BaseClient } from './base-client';

export class WebhookClient extends BaseClient {
  /**
   * List all webhooks
   */
  async list(): Promise<WebhookConfig[]> {
    const response = await this.request<{ success: boolean; data: { webhooks: WebhookConfig[] } }>('/api/webhooks');
    return response.data.webhooks;
  }

  /**
   * Get webhook by ID
   */
  async get(id: string): Promise<WebhookConfig> {
    const response = await this.request<{ success: boolean; data: WebhookConfig }>(\`/api/webhooks/\${id}\`);
    return response.data;
  }

  /**
   * Create a new webhook
   */
  async create(webhook: Omit<WebhookConfig, '_id' | 'createdAt' | 'updatedAt'>): Promise<WebhookConfig> {
    const response = await this.request<ApiResponse<WebhookConfig>>('/api/webhooks', {
      method: 'POST',
      body: JSON.stringify(webhook)
    });
    return response.data!;
  }

  /**
   * Update an existing webhook
   */
  async update(id: string, webhook: Partial<WebhookConfig>): Promise<WebhookConfig> {
    const response = await this.request<ApiResponse<WebhookConfig>>(\`/api/webhooks/\${id}\`, {
      method: 'PUT',
      body: JSON.stringify(webhook)
    });
    return response.data!;
  }

  /**
   * Delete a webhook
   */
  async delete(id: string): Promise<void> {
    await this.request(\`/api/webhooks/\${id}\`, {
      method: 'DELETE'
    });
  }

  /**
   * Test a webhook delivery
   */
  async test(id: string): Promise<ApiResponse> {
    return this.request<ApiResponse>(\`/api/webhooks/\${id}/test\`, {
      method: 'POST'
    });
  }

  /**
   * Get webhook delivery statistics
   */
  async getStats(): Promise<WebhookStats> {
    const response = await this.request<{ success: boolean; data: WebhookStats }>('/api/webhooks/stats');
    return response.data;
  }

  /**
   * Enable a webhook
   */
  async enable(id: string): Promise<WebhookConfig> {
    return this.update(id, { enabled: true });
  }

  /**
   * Disable a webhook
   */
  async disable(id: string): Promise<WebhookConfig> {
    return this.update(id, { enabled: false });
  }

  /**
   * Update webhook rate limits
   */
  async updateRateLimit(id: string, rateLimit: WebhookConfig['rateLimit']): Promise<WebhookConfig> {
    return this.update(id, { rateLimit });
  }
}
`;

    await fs.writeFile(path.join(outputDir, 'webhook-client.ts'), webhookClientCode);
  }

  /**
   * Generate main SDK class
   */
  async generateMainSDK(outputDir, collections) {
    let sdkContent = `import { CollectionInfo, HealthStatus } from './types';
import { BaseClient } from './base-client';
import { WebhookClient } from './webhook-client';
`;

    // Import collection clients
    collections.forEach(collection => {
      const className = `${this.toTitleCase(collection.name)}Client`;
      sdkContent += `import { ${className} } from './${collection.name}-client';\n`;
    });

    sdkContent += `
export class MongoDBCrudSDK extends BaseClient {
  public webhooks: WebhookClient;
`;

    // Add collection properties
    collections.forEach(collection => {
      const className = `${this.toTitleCase(collection.name)}Client`;
      sdkContent += `  public ${collection.name}: ${className};\n`;
    });

    sdkContent += `
  constructor(apiUrl: string = 'http://localhost:3001', authToken?: string) {
    super(apiUrl, authToken);
    
    this.webhooks = new WebhookClient(apiUrl, authToken);
`;

    // Initialize collection clients
    collections.forEach(collection => {
      const className = `${this.toTitleCase(collection.name)}Client`;
      sdkContent += `    this.${collection.name} = new ${className}(apiUrl, authToken);\n`;
    });

    sdkContent += `  }

  /**
   * Set authentication token for all clients
   */
  setAuthToken(token: string): void {
    super.setAuthToken(token);
    this.webhooks.setAuthToken(token);
`;

    collections.forEach(collection => {
      sdkContent += `    this.${collection.name}.setAuthToken(token);\n`;
    });

    sdkContent += `  }

  /**
   * Set API URL for all clients
   */
  setApiUrl(url: string): void {
    super.setApiUrl(url);
    this.webhooks.setApiUrl(url);
`;

    collections.forEach(collection => {
      sdkContent += `    this.${collection.name}.setApiUrl(url);\n`;
    });

    sdkContent += `  }

  /**
   * Get list of all collections
   */
  async getCollections(): Promise<CollectionInfo[]> {
    const response = await this.request<{ success: boolean; collections: CollectionInfo[] }>('/api/management/collections');
    return response.collections;
  }

  /**
   * Create a new collection
   */
  async createCollection(name: string): Promise<void> {
    await this.request('/api/management/collections', {
      method: 'POST',
      body: JSON.stringify({ name })
    });
  }

  /**
   * Delete a collection
   */
  async deleteCollection(name: string): Promise<void> {
    await this.request(\`/api/management/collections/\${name}\`, {
      method: 'DELETE'
    });
  }

  /**
   * Check API health status
   */
  async getHealth(): Promise<HealthStatus> {
    return this.request<HealthStatus>('/api/management/health');
  }
}
`;

    await fs.writeFile(path.join(outputDir, 'sdk.ts'), sdkContent);
  }

  /**
   * Generate index file with exports
   */
  async generateIndex(outputDir, collections) {
    let indexContent = `// Auto-generated MongoDB CRUD API SDK
// Generated on: ${new Date().toISOString()}

// Export all types
export * from './types';

// Export base client
export { BaseClient } from './base-client';

// Export webhook client
export { WebhookClient } from './webhook-client';

// Export collection clients
`;

    collections.forEach(collection => {
      const className = `${this.toTitleCase(collection.name)}Client`;
      indexContent += `export { ${className} } from './${collection.name}-client';\n`;
    });

    indexContent += `
// Export main SDK
export { MongoDBCrudSDK } from './sdk';

// Default export
export { MongoDBCrudSDK as default } from './sdk';
`;

    await fs.writeFile(path.join(outputDir, 'index.ts'), indexContent);
  }

  /**
   * Generate package.json for the SDK
   */
  async generatePackageJson(outputDir, packageName) {
    const packageJson = {
      name: packageName,
      version: '1.0.0',
      description: 'Auto-generated TypeScript SDK for MongoDB CRUD REST API',
      main: 'dist/index.js',
      types: 'dist/index.d.ts',
      scripts: {
        build: 'tsc',
        'build:watch': 'tsc --watch',
        clean: 'rimraf dist',
        prepublishOnly: 'npm run clean && npm run build'
      },
      dependencies: {},
      devDependencies: {
        typescript: '^5.0.0',
        rimraf: '^5.0.0'
      },
      peerDependencies: {
        'node-fetch': '^3.0.0'
      },
      files: [
        'dist/**/*',
        'README.md'
      ],
      keywords: [
        'mongodb',
        'crud',
        'api',
        'sdk',
        'typescript',
        'rest'
      ],
      license: 'MIT',
      repository: {
        type: 'git',
        url: 'https://github.com/your-org/mongodb-crud-sdk'
      }
    };

    await fs.writeFile(
      path.join(outputDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );
  }

  /**
   * Generate TypeScript configuration
   */
  async generateTSConfig(outputDir) {
    const tsConfig = {
      compilerOptions: {
        target: 'ES2020',
        module: 'commonjs',
        lib: ['ES2020', 'DOM'],
        outDir: './dist',
        rootDir: '.',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        declaration: true,
        declarationMap: true,
        sourceMap: true
      },
      include: [
        '*.ts'
      ],
      exclude: [
        'node_modules',
        'dist'
      ]
    };

    await fs.writeFile(
      path.join(outputDir, 'tsconfig.json'),
      JSON.stringify(tsConfig, null, 2)
    );
  }

  /**
   * Generate SDK README
   */
  async generateSDKReadme(outputDir, packageName, collections) {
    const readme = `# ${packageName}

Auto-generated TypeScript SDK for MongoDB CRUD REST API.

## Installation

\`\`\`bash
npm install ${packageName}
\`\`\`

## Quick Start

\`\`\`typescript
import { MongoDBCrudSDK } from '${packageName}';

// Initialize SDK
const sdk = new MongoDBCrudSDK('http://localhost:3001');

// Set authentication token if required
sdk.setAuthToken('your-jwt-token');

// Use collection clients
${collections.slice(0, 3).map(collection => `const ${collection.name}List = await sdk.${collection.name}.list();
const new${this.toTitleCase(collection.name)} = await sdk.${collection.name}.create({ name: 'Example' });
const ${collection.name} = await sdk.${collection.name}.get('document-id');
await sdk.${collection.name}.update('document-id', { name: 'Updated' });
await sdk.${collection.name}.delete('document-id');`).join('\n\n')}

// Webhook management
const webhooks = await sdk.webhooks.list();
const webhook = await sdk.webhooks.create({
  name: 'My Webhook',
  url: 'https://example.com/webhook',
  collection: 'users',
  events: ['create', 'update'],
  filters: { status: 'active' }
});
\`\`\`

## Features

- **Type-safe operations** for all collections
- **Advanced filtering** with MongoDB-style queries
- **Pagination support** with configurable limits
- **Webhook management** with rate limiting
- **Authentication support** via JWT tokens
- **Comprehensive error handling**
- **Auto-completion** and IntelliSense support

## Available Collections

${collections.map(collection => `- **${this.toTitleCase(collection.name)}Client**: CRUD operations for ${collection.name} collection`).join('\n')}

## Advanced Usage

### Filtering and Queries

\`\`\`typescript
// Basic filtering
const activeUsers = await sdk.users.list({ 
  filter: { status: 'active' } 
});

// Advanced MongoDB-style queries
const results = await sdk.users.query({
  age: { $gte: 18, $lt: 65 },
  status: { $in: ['active', 'pending'] },
  'profile.department': 'Engineering'
});

// Pagination and sorting
const pagedResults = await sdk.users.list({
  page: 2,
  limit: 20,
  sort: '-createdAt',
  fields: 'name,email,status'
});
\`\`\`

### Webhook Management

\`\`\`typescript
// Create webhook with rate limiting
const webhook = await sdk.webhooks.create({
  name: 'Order Processing',
  url: 'https://api.example.com/webhooks/orders',
  collection: 'orders',
  events: ['create', 'update'],
  filters: { 
    total: { $gte: 100 },
    status: 'pending' 
  },
  rateLimit: {
    maxRequestsPerMinute: 60,
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 30000
  }
});

// Test webhook delivery
await sdk.webhooks.test(webhook._id);

// Get delivery statistics
const stats = await sdk.webhooks.getStats();
\`\`\`

### Error Handling

\`\`\`typescript
try {
  const user = await sdk.users.get('invalid-id');
} catch (error) {
  console.error('Failed to get user:', error.message);
}
\`\`\`

## API Reference

This SDK provides complete TypeScript interfaces and comprehensive documentation for all available operations. All methods return properly typed responses with full IntelliSense support.

## Generated On

${new Date().toISOString()}

## License

MIT
`;

    await fs.writeFile(path.join(outputDir, 'README.md'), readme);
  }

  /**
   * Get list of generated files
   */
  async getGeneratedFiles(outputDir) {
    const files = await fs.readdir(outputDir);
    return files.map(file => path.join(outputDir, file));
  }

  /**
   * Helper methods
   */
  toTitleCase(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Map JSON schema types to TypeScript types
   */
  mapSchemaToTypeScript(schema) {
    if (schema.oneOf) {
      return schema.oneOf.map(s => this.mapSchemaToTypeScript(s)).join(' | ');
    }

    switch (schema.type) {
      case 'string':
        if (schema.pattern === '^[0-9a-fA-F]{24}$') return 'string'; // ObjectId
        if (schema.format === 'date-time') return 'Date | string';
        return 'string';
      case 'number':
        return 'number';
      case 'boolean':
        return 'boolean';
      case 'array':
        return 'any[]';
      case 'object':
        return 'Record<string, any>';
      default:
        return 'any';
    }
  }
}

module.exports = SDKGeneratorService;
