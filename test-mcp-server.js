#!/usr/bin/env node

const express = require('express');

const app = express();
const PORT = process.env.MCP_PORT || 3001;

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
    { name: 'list_api_entries', description: 'List all API entries', inputSchema: { type: 'object', properties: { limit: { type: 'number' } } } },
    { name: 'get_api_entry', description: 'Get API entry by ID', inputSchema: { type: 'object', properties: { id: { type: 'number' } } } },
    { name: 'create_api_entry', description: 'Create new API entry', inputSchema: { type: 'object', properties: { name: { type: 'string' }, apiKey: { type: 'string' } } } },
    { name: 'update_api_entry', description: 'Update API entry', inputSchema: { type: 'object', properties: { id: { type: 'number' } } } },
    { name: 'delete_api_entry', description: 'Delete API entry', inputSchema: { type: 'object', properties: { id: { type: 'number' } } } },
    { name: 'export_api_entries', description: 'Export API entries', inputSchema: { type: 'object' } },
    { name: 'import_api_entries', description: 'Import API entries', inputSchema: { type: 'object' } },
    { name: 'get_database_stats', description: 'Get database statistics', inputSchema: { type: 'object' } }
  ];
  res.json({ tools });
});

// MCP Execute endpoint
app.post('/mcp/execute', async (req, res) => {
  try {
    const { tool, params } = req.body;
    
    // Mock implementations for testing
    let result;
    switch (tool) {
      case 'list_api_entries':
        result = { entries: [], total: 0 };
        break;
      case 'get_database_stats':
        result = { totalEntries: 0, uptime: process.uptime() };
        break;
      default:
        result = { message: 'Tool executed successfully' };
    }
    
    res.json({ result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`MCP Server running on port ${PORT}`);
  console.log(`Health: http://localhost:${PORT}/mcp/health`);
  console.log(`Tools: http://localhost:${PORT}/mcp/tools`);
});