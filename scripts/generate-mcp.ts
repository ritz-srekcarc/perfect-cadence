import fs from 'fs';
import path from 'path';
import { SYNTAX_DOCS } from '../src/timelineParser';

const DIST_MCP = 'dist/mcp';

function generate() {
  if (!fs.existsSync(DIST_MCP)) {
    fs.mkdirSync(DIST_MCP, { recursive: true });
  }
  if (!fs.existsSync(path.join(DIST_MCP, 'resources'))) {
    fs.mkdirSync(path.join(DIST_MCP, 'resources'), { recursive: true });
  }
  if (!fs.existsSync(path.join(DIST_MCP, 'tools'))) {
    fs.mkdirSync(path.join(DIST_MCP, 'tools'), { recursive: true });
  }

  const manifest = {
    protocolVersion: "2024-11-05", // Standard MCP date
    serverInfo: {
      name: "perfect-cadence-mcp",
      version: "0.1.0"
    },
    capabilities: {
      resources: [
        {
          uri: "perfect-cadence://syntax",
          name: "Perfect Cadence Syntax",
          description: "Documentation for Perfect Cadence timeline syntax",
          mimeType: "application/json"
        }
      ],
      tools: [
        {
          name: "get_syntax_info",
          description: "Get documentation for Perfect Cadence syntax",
          inputSchema: {
            type: "object",
            properties: {},
            required: []
          }
        }
      ]
    }
  };

  fs.writeFileSync(path.join(DIST_MCP, 'mcp.json'), JSON.stringify(manifest, null, 2));

  // Resource: perfect-cadence://syntax
  const syntaxResource = {
    syntax: SYNTAX_DOCS
  };
  fs.writeFileSync(path.join(DIST_MCP, 'resources', 'perfect-cadence-syntax.json'), JSON.stringify(syntaxResource, null, 2));
}

generate();
