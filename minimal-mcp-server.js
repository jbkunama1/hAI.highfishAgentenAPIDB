#!/usr/bin/env node

const express = require('express');
const { Server } = require('node:http');

const app = express();
const PORT = process.env.MCP_PORT || 3001;

// Express middleware
app.use(express.json());

// MCP Health endpoint
app.get('/mcp/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    tools: ['list_api_entries', 'get_api_entry', 'create_api_entry', 'update_api_entry', 'delete_api_entry', 'export_api_entries', 'import_api_entries', 'get_database_stats'], 
    timestamp: new Date().toISOString() 
  });
});

// MCP Tools endpoint
app.get('/mcp/tools', (req, res) => {
  const tools = [
    { name: 'list_api_entries', description: 'List all API entries with optional filtering', inputSchema: { type: 'object', properties: { limit: { type: 'number' }, page: { type: 'number' }, search: { type: 'string' }, category: { type: 'string' } } } },
    { name: 'get_api_entry', description: 'Get a specific API entry by ID', inputSchema: { type: 'object', properties: { id: { type: 'number' } } } },
    { name: 'create_api_entry', description: 'Create a new API entry in the database', inputSchema: { type: 'object', properties: { name: { type: 'string' }, url: { type: 'string' }, apiKey: { type: 'string' }, category: { type: 'string' }, notes: { type: 'string' } } } },
    { name: 'update_api_entry', description: 'Update an existing API entry', inputSchema: { type: 'object', properties: { id: { type: 'number' }, name: { type: 'string' }, url: { type: 'string' }, apiKey: { type: 'string' }, category: { type: 'string' }, notes: { type: 'string' } } } },
    { name: 'delete_api_entry', description: 'Delete an API entry from the database', inputSchema: { type: 'object', properties: { id: { type: 'number' } } } },
    { name: 'export_api_entries', description: 'Export all API entries as JSON, CSV, or TXT', inputSchema: { type: 'object', properties: { format: { type: 'string', enum: ['json', 'csv', 'txt'] }, search: { type: 'string' } } } },
    { name: 'import_api_entries', description: 'Import API entries from JSON or text data', inputSchema: { type: 'object', properties: { data: { type: 'array' }, format: { type: 'string', enum: ['json', 'text'] } } } },
    { name: 'get_database_stats', description: 'Get database statistics and system information', inputSchema: { type: 'object' } }
  ];
  res.json({ tools });
});

// MCP Execute endpoint
app.post('/mcp/execute', async (req, res) => {
  try {
    const { tool, params } = req.body;
    
    // Mock implementations for now
    let result;
    switch (tool) {
      case 'list_api_entries':
        result = { entries: [], total: 0, page: params?.page || 1, limit: params?.limit || 100 };
        break;
      case 'get_database_stats':
        result = { 
          totalEntries: 0, 
          categories: ['AI', 'Weather', 'Finance', 'Social'],
          uptime: process.uptime(), 
          memory: process.memoryUsage(),
          timestamp: new Date().toISOString()
        };
        break;
      case 'create_api_entry':
        result = { success: true, entry: { id: Date.now(), name: params?.name, apiKey: params?.apiKey }, message: 'Entry created successfully' };
        break;
      case 'export_api_entries':
        result = { data: [], format: params?.format || 'json' };
        break;
      default:
        result = { success: true, message: 'Tool executed successfully' };
    }
    
    res.json({ result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
const server = new Server(app);
server.listen(PORT, () => {
  console.log(`MCP Server running on port ${PORT}`);
  console.log(`Health: http://localhost:${PORT}/mcp/health`);
  console.log(`Tools: http://localhost:${PORT}/mcp/tools`);
});

server.on('error', (err) => {
  console.error('MCP Server error:', err);
});