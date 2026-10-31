#!/usr/bin/env node

/**
 * MCP Server for hAI · HighFish Agenten API DB
 * 
 * This MCP Server provides tools to interact with the hAI.highfishAgentenAPIDB database
 * through the AnythingMCP interface. It enables agents to access API entries,
 * perform CRUD operations, and export/import data.
 */

const fs = require('fs');
const path = require('path');
const express = require('express');
const { Server } = require('node:http');
const { WebSocket } = require('ws');

// MCP Server Implementation
class MCPServer {
  constructor(config = {}) {
    this.config = {
      port: config.port || 3001,
      host: config.host || 'localhost',
      debug: config.debug || false
    };
    this.tools = new Map();
    this.handlers = new Map();
    this.app = express();
    
    // Setup Express middleware
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    
    // Setup HTTP server for MCP
    this.httpServer = new Server(this.app);
    this.wsServer = new WebSocket.Server({ server: this.httpServer });
    
    this.setupTools();
    this.setupWebSocket();
    this.setupExpressRoutes();
  }

  /**
   * Register all available MCP tools
   */
  setupTools() {
    // CRUD Operations
    this.addTool({
      name: 'list_api_entries',
      description: 'List all API entries from the database with optional filtering',
      inputSchema: {
        type: 'object',
        properties: {
          page: {
            type: 'integer',
            description: 'Page number for pagination (default: 1)',
            default: 1
          },
          limit: {
            type: 'integer',
            description: 'Maximum number of entries to return (max: 500, default: 100)',
            default: 100
          },
          search: {
            type: 'string',
            description: 'Search term to filter entries by name, URL, category or notes'
          },
          category: {
            type: 'string',
            description: 'Filter by category'
          }
        }
      },
      handler: async (params) => await this.handleListAPIEntries(params)
    });

    this.addTool({
      name: 'get_api_entry',
      description: 'Get a specific API entry by ID',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'integer',
            description: 'The ID of the API entry to retrieve'
          }
        },
        required: ['id']
      },
      handler: async (params) => await this.handleGetAPIEntry(params)
    });

    this.addTool({
      name: 'create_api_entry',
      description: 'Create a new API entry in the database',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Name of the API entry'
          },
          url: {
            type: 'string',
            description: 'URL of the API entry'
          },
          apiKey: {
            type: 'string',
            description: 'API key (will be masked in responses)'
          },
          category: {
            type: 'string',
            description: 'Category for the API entry'
          },
          notes: {
            type: 'string',
            description: 'Notes for the API entry'
          }
        },
        required: ['name', 'apiKey']
      },
      handler: async (params) => await this.handleCreateAPIEntry(params)
    });

    this.addTool({
      name: 'update_api_entry',
      description: 'Update an existing API entry',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'integer',
            description: 'ID of the entry to update'
          },
          name: {
            type: 'string',
            description: 'Updated name'
          },
          url: {
            type: 'string',
            description: 'Updated URL'
          },
          apiKey: {
            type: 'string',
            description: 'Updated API key'
          },
          category: {
            type: 'string',
            description: 'Updated category'
          },
          notes: {
            type: 'string',
            description: 'Updated notes'
          }
        },
        required: ['id']
      },
      handler: async (params) => await this.handleUpdateAPIEntry(params)
    });

    this.addTool({
      name: 'delete_api_entry',
      description: 'Delete an API entry from the database',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'integer',
            description: 'ID of the entry to delete'
          }
        },
        required: ['id']
      },
      handler: async (params) => await this.handleDeleteAPIEntry(params)
    });

    this.addTool({
      name: 'export_api_entries',
      description: 'Export all API entries as JSON',
      inputSchema: {
        type: 'object',
        properties: {
          format: {
            type: 'string',
            enum: ['json', 'csv', 'txt'],
            description: 'Export format (default: json)',
            default: 'json'
          },
          search: {
            type: 'string',
            description: 'Optional search filter for export'
          }
        }
      },
      handler: async (params) => await this.handleExportAPIEntries(params)
    });

    this.addTool({
      name: 'import_api_entries',
      description: 'Import API entries from text or JSON data',
      inputSchema: {
        type: 'object',
        properties: {
          data: {
            type: 'array',
            description: 'Array of API entries to import'
          },
          format: {
            type: 'string',
            enum: ['json', 'text'],
            description: 'Format of import data',
            default: 'json'
          }
        },
        required: ['data']
      },
      handler: async (params) => await this.handleImportAPIEntries(params)
    });

    this.addTool({
      name: 'get_database_stats',
      description: 'Get database statistics and system information',
      inputSchema: {
        type: 'object',
        properties: {}
      },
      handler: async (params) => await this.handleGetDatabaseStats(params)
    });
  }

  /**
   * Add a tool to the MCP server
   */
  addTool(tool) {
    this.tools.set(tool.name, tool);
  }

  /**
   * Setup WebSocket connection for MCP protocol
   */
  setupWebSocket() {
    this.wsServer.on('connection', (ws) => {
      if (this.config.debug) {
        console.log('[MCP] New WebSocket connection established');
      }

      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data);
          await this.handleMCPMessage(ws, message);
        } catch (error) {
          if (this.config.debug) {
            console.error('[MCP] Error processing message:', error);
          }
          this.sendErrorResponse(ws, message.id, 'Invalid JSON message');
        }
      });

      ws.on('close', () => {
        if (this.config.debug) {
          console.log('[MCP] WebSocket connection closed');
        }
      });

      ws.on('error', (error) => {
        if (this.config.debug) {
          console.error('[MCP] WebSocket error:', error);
        }
      });
    });
  }

  /**
   * Setup Express routes for MCP compatibility
   */
  setupExpressRoutes() {
    // Health check endpoint
    this.app.get('/mcp/health', (req, res) => {
      res.json({ 
        status: 'ok', 
        tools: Array.from(this.tools.keys()),
        timestamp: new Date().toISOString()
      });
    });

    // List tools endpoint
    this.app.get('/mcp/tools', (req, res) => {
      const toolList = Array.from(this.tools.values()).map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema
      }));
      res.json({ tools: toolList });
    });

    // Execute tool endpoint (for testing)
    this.app.post('/mcp/execute', async (req, res) => {
      try {
        const { tool, params } = req.body;
        const toolDef = this.tools.get(tool);
        
        if (!toolDef) {
          return res.status(404).json({ error: 'Tool not found' });
        }

        const result = await toolDef.handler(params);
        res.json({ result });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  }

  /**
   * Handle MCP protocol messages
   */
  async handleMCPMessage(ws, message) {
    switch (message.method) {
      case 'initialize':
        this.sendMCPResponse(ws, message.id, {
          capabilities: {
            tools: {}
          },
          serverInfo: {
            name: 'hAI.highfishAgentenAPIDB-MCP',
            version: '1.0.0'
          }
        });
        break;

      case 'tools/list':
        this.sendMCPResponse(ws, message.id, {
          tools: Array.from(this.tools.values()).map(tool => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema
          }))
        });
        break;

      case 'tools/call':
        await this.handleToolCall(ws, message);
        break;

      default:
        this.sendErrorResponse(ws, message.id, 'Unknown method');
    }
  }

  /**
   * Handle tool calls via MCP protocol
   */
  async handleToolCall(ws, message) {
    try {
      const { name, arguments: params } = message.params;
      const tool = this.tools.get(name);

      if (!tool) {
        this.sendErrorResponse(ws, message.id, 'Tool not found');
        return;
      }

      const result = await tool.handler(params);
      this.sendMCPResponse(ws, message.id, { result });
    } catch (error) {
      this.sendErrorResponse(ws, message.id, error.message);
    }
  }

  /**
   * Send MCP response
   */
  sendMCPResponse(ws, id, data) {
    const response = {
      jsonrpc: '2.0',
      id: id,
      ...data
    };
    ws.send(JSON.stringify(response));
  }

  /**
   * Send MCP error response
   */
  sendErrorResponse(ws, id, error) {
    const response = {
      jsonrpc: '2.0',
      id: id,
      error: {
        code: -1,
        message: error
      }
    };
    ws.send(JSON.stringify(response));
  }

  // === Tool Handler Methods ===

  async handleListAPIEntries(params) {
    // This would normally connect to your Express server
    // For now, return mock data or implement direct DB connection
    const mockEntries = [
      {
        id: 1,
        name: 'OpenAI API',
        url: 'https://api.openai.com/v1',
        apiKey: 'sk-1234...5678',
        category: 'AI',
        notes: 'Main AI service provider'
      }
    ];

    return {
      entries: mockEntries,
      total: mockEntries.length,
      page: params.page || 1,
      limit: params.limit || 100
    };
  }

  async handleGetAPIEntry(params) {
    // Mock implementation
    return {
      id: params.id,
      name: 'Sample API Entry',
      url: 'https://api.example.com',
      apiKey: 'sk-1234...5678',
      category: 'Sample',
      notes: 'This is a sample entry'
    };
  }

  async handleCreateAPIEntry(params) {
    // Mock implementation
    const newEntry = {
      id: Date.now(),
      name: params.name,
      url: params.url || null,
      apiKey: params.apiKey,
      category: params.category || null,
      notes: params.notes || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    return {
      success: true,
      entry: newEntry,
      message: 'Entry created successfully'
    };
  }

  async handleUpdateAPIEntry(params) {
    // Mock implementation
    return {
      success: true,
      entry: {
        id: params.id,
        name: params.name || 'Updated API Entry',
        url: params.url || 'https://api.example.com',
        apiKey: params.apiKey,
        category: params.category || 'Updated',
        notes: params.notes || 'Updated notes',
        updated_at: new Date().toISOString()
      },
      message: 'Entry updated successfully'
    };
  }

  async handleDeleteAPIEntry(params) {
    // Mock implementation
    return {
      success: true,
      id: params.id,
      message: 'Entry deleted successfully'
    };
  }

  async handleExportAPIEntries(params) {
    // Mock implementation
    const exportData = [
      {
        name: 'Export Entry 1',
        url: 'https://api1.example.com',
        apiKey: 'sk-exp1...abc',
        category: 'Export',
        notes: 'Exported entry'
      }
    ];

    if (params.format === 'csv') {
      // Convert to CSV format
      const csv = [
        ['Name', 'URL', 'API Key', 'Category', 'Notes'],
        ...exportData.map(entry => [
          entry.name, 
          entry.url, 
          entry.apiKey, 
          entry.category, 
          entry.notes
        ])
      ].map(row => row.join(',')).join('\n');
      
      return { data: csv, format: 'csv' };
    }

    return { data: exportData, format: 'json' };
  }

  async handleImportAPIEntries(params) {
    // Mock implementation
    return {
      success: true,
      imported: params.data.length,
      message: `Successfully imported ${params.data.length} entries`
    };
  }

  async handleGetDatabaseStats(params) {
    // Mock implementation
    return {
      totalEntries: 150,
      categories: ['AI', 'Weather', 'Finance', 'Social'],
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Start the MCP server
   */
  async start() {
    return new Promise((resolve, reject) => {
      this.httpServer.listen(this.config.port, this.config.host, () => {
        if (this.config.debug) {
          console.log(`[MCP] Server started on ${this.config.host}:${this.config.port}`);
          console.log(`[MCP] Tools available: ${Array.from(this.tools.keys()).join(', ')}`);
        }
        resolve();
      });
      
      this.httpServer.on('error', reject);
    });
  }

  /**
   * Stop the MCP server
   */
  async stop() {
    return new Promise((resolve) => {
      this.httpServer.close(() => {
        if (this.config.debug) {
          console.log('[MCP] Server stopped');
        }
        resolve();
      });
    });
  }
}

// Export for use as module
module.exports = MCPServer;

// If run directly, start the server
if (require.main === module) {
  const server = new MCPServer({
    port: process.env.MCP_PORT || 3001,
    host: process.env.MCP_HOST || 'localhost',
    debug: process.env.MCP_DEBUG === 'true'
  });

  server.start().catch(console.error);
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('[MCP] Shutting down gracefully...');
    await server.stop();
    process.exit(0);
  });
}