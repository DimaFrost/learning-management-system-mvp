import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';
import readline from 'node:readline';

const SERVER_NAME = 'tbo-supabase-mcp';
const SERVER_VERSION = '0.1.0';
const MAX_LIMIT = 500;

function readEnvFile(path) {
  if (!existsSync(path)) return {};

  return Object.fromEntries(
    readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#') && line.includes('='))
      .map(line => {
        const index = line.indexOf('=');
        return [line.slice(0, index), line.slice(index + 1).trim()];
      })
  );
}

const env = {
  ...readEnvFile('.env.local'),
  ...readEnvFile('.env.mcp.local'),
  ...process.env,
};

const supabaseUrl = env.MCP_SUPABASE_URL ?? env.SUPABASE_URL ?? env.VITE_SUPABASE_URL;
const serviceRoleKey = env.MCP_SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;

function requireConfig() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Missing MCP_SUPABASE_URL/VITE_SUPABASE_URL or MCP_SUPABASE_SERVICE_ROLE_KEY. Create .env.mcp.local from .env.mcp.example.'
    );
  }

  if (serviceRoleKey === env.VITE_SUPABASE_ANON_KEY) {
    throw new Error('MCP_SUPABASE_SERVICE_ROLE_KEY must be the service_role key, not the public anon key.');
  }
}

const supabase = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

function json(value) {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

function text(value) {
  return {
    content: [
      {
        type: 'text',
        text: String(value),
      },
    ],
  };
}

function clampLimit(limit) {
  const parsed = Number(limit ?? 100);
  if (!Number.isFinite(parsed) || parsed <= 0) return 100;
  return Math.min(Math.floor(parsed), MAX_LIMIT);
}

function applyFilters(query, filters = {}) {
  for (const [column, raw] of Object.entries(filters ?? {})) {
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      const operator = raw.operator ?? 'eq';
      const value = raw.value;
      if (operator === 'eq') query = query.eq(column, value);
      else if (operator === 'neq') query = query.neq(column, value);
      else if (operator === 'gt') query = query.gt(column, value);
      else if (operator === 'gte') query = query.gte(column, value);
      else if (operator === 'lt') query = query.lt(column, value);
      else if (operator === 'lte') query = query.lte(column, value);
      else if (operator === 'ilike') query = query.ilike(column, value);
      else if (operator === 'in') query = query.in(column, Array.isArray(value) ? value : [value]);
      else throw new Error(`Unsupported filter operator "${operator}" for column "${column}".`);
    } else {
      query = query.eq(column, raw);
    }
  }
  return query;
}

async function runSupabase(operation) {
  requireConfig();
  return operation(supabase);
}

const tools = [
  {
    name: 'project_info',
    description: 'Return the configured Supabase project URL and whether a service-role key is loaded. Does not reveal secrets.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'schema_summary',
    description: 'Read the Supabase REST/OpenAPI schema and return table names plus columns exposed through the Data API.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'select_rows',
    description: 'Select rows from a Supabase table using service-role credentials. Filters are exact matches by default.',
    inputSchema: {
      type: 'object',
      required: ['table'],
      properties: {
        table: { type: 'string' },
        select: { type: 'string', default: '*' },
        filters: {
          type: 'object',
          description: 'Column filters. Use {"email":"a@b.com"} or {"created_at":{"operator":"gte","value":"2026-01-01"}}.',
          additionalProperties: true,
        },
        limit: { type: 'number', default: 100 },
        order: {
          type: 'object',
          properties: {
            column: { type: 'string' },
            ascending: { type: 'boolean', default: true },
          },
          additionalProperties: false,
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'insert_rows',
    description: 'Insert one row or an array of rows into a Supabase table.',
    inputSchema: {
      type: 'object',
      required: ['table', 'rows'],
      properties: {
        table: { type: 'string' },
        rows: {
          oneOf: [
            { type: 'object', additionalProperties: true },
            { type: 'array', items: { type: 'object', additionalProperties: true } },
          ],
        },
        select: { type: 'string', default: '*' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'update_rows',
    description: 'Update rows in a Supabase table. Requires filters to avoid accidental broad updates.',
    inputSchema: {
      type: 'object',
      required: ['table', 'values', 'filters'],
      properties: {
        table: { type: 'string' },
        values: { type: 'object', additionalProperties: true },
        filters: { type: 'object', additionalProperties: true },
        select: { type: 'string', default: '*' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'delete_rows',
    description: 'Delete rows from a Supabase table. Requires filters to avoid accidental broad deletes.',
    inputSchema: {
      type: 'object',
      required: ['table', 'filters'],
      properties: {
        table: { type: 'string' },
        filters: { type: 'object', additionalProperties: true },
        select: { type: 'string', default: '*' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'call_rpc',
    description: 'Call a Supabase Postgres function through rpc().',
    inputSchema: {
      type: 'object',
      required: ['functionName'],
      properties: {
        functionName: { type: 'string' },
        args: { type: 'object', additionalProperties: true, default: {} },
      },
      additionalProperties: false,
    },
  },
];

async function callTool(name, args = {}) {
  if (name === 'project_info') {
    return json({
      supabaseUrl,
      serviceRoleLoaded: Boolean(serviceRoleKey),
      usingPublicAnonKeyAsServiceRole: Boolean(serviceRoleKey && serviceRoleKey === env.VITE_SUPABASE_ANON_KEY),
    });
  }

  if (name === 'schema_summary') {
    requireConfig();
    const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/`, {
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
        accept: 'application/openapi+json',
      },
    });

    if (!response.ok) {
      throw new Error(`OpenAPI request failed: ${response.status} ${await response.text()}`);
    }

    const spec = await response.json();
    const definitions = spec.definitions ?? {};
    const tables = Object.entries(definitions).map(([table, definition]) => ({
      table,
      columns: Object.keys(definition.properties ?? {}),
    }));
    return json({ tables });
  }

  if (name === 'select_rows') {
    return runSupabase(async client => {
      let query = client
        .from(args.table)
        .select(args.select ?? '*')
        .limit(clampLimit(args.limit));
      query = applyFilters(query, args.filters);
      if (args.order?.column) {
        query = query.order(args.order.column, { ascending: args.order.ascending ?? true });
      }
      const { data, error } = await query;
      if (error) throw error;
      return json(data);
    });
  }

  if (name === 'insert_rows') {
    return runSupabase(async client => {
      const { data, error } = await client
        .from(args.table)
        .insert(args.rows)
        .select(args.select ?? '*');
      if (error) throw error;
      return json(data);
    });
  }

  if (name === 'update_rows') {
    return runSupabase(async client => {
      if (!args.filters || Object.keys(args.filters).length === 0) {
        throw new Error('update_rows requires at least one filter.');
      }
      let query = client
        .from(args.table)
        .update(args.values)
        .select(args.select ?? '*');
      query = applyFilters(query, args.filters);
      const { data, error } = await query;
      if (error) throw error;
      return json(data);
    });
  }

  if (name === 'delete_rows') {
    return runSupabase(async client => {
      if (!args.filters || Object.keys(args.filters).length === 0) {
        throw new Error('delete_rows requires at least one filter.');
      }
      let query = client
        .from(args.table)
        .delete()
        .select(args.select ?? '*');
      query = applyFilters(query, args.filters);
      const { data, error } = await query;
      if (error) throw error;
      return json(data);
    });
  }

  if (name === 'call_rpc') {
    return runSupabase(async client => {
      const { data, error } = await client.rpc(args.functionName, args.args ?? {});
      if (error) throw error;
      return json(data);
    });
  }

  throw new Error(`Unknown tool "${name}".`);
}

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

async function handle(message) {
  if (message.method === 'initialize') {
    send({
      jsonrpc: '2.0',
      id: message.id,
      result: {
        protocolVersion: message.params?.protocolVersion ?? '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
      },
    });
    return;
  }

  if (message.method === 'notifications/initialized') return;

  if (message.method === 'tools/list') {
    send({
      jsonrpc: '2.0',
      id: message.id,
      result: { tools },
    });
    return;
  }

  if (message.method === 'tools/call') {
    try {
      const result = await callTool(message.params?.name, message.params?.arguments ?? {});
      send({ jsonrpc: '2.0', id: message.id, result });
    } catch (error) {
      send({
        jsonrpc: '2.0',
        id: message.id,
        result: {
          isError: true,
          content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }],
        },
      });
    }
    return;
  }

  if (message.id !== undefined) {
    send({
      jsonrpc: '2.0',
      id: message.id,
      error: { code: -32601, message: `Method not found: ${message.method}` },
    });
  }
}

const rl = readline.createInterface({ input: process.stdin });

rl.on('line', line => {
  if (!line.trim()) return;
  try {
    void handle(JSON.parse(line));
  } catch (error) {
    send({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32700, message: error instanceof Error ? error.message : String(error) },
    });
  }
});

process.stderr.write(`${SERVER_NAME} ready\n`);
