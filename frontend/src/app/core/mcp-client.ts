import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';

export type McpToolName = 'search_customer' | 'get_order' | 'check_inventory';

export interface McpToolResult<T> {
  status: string;
  data: T | null;
  error: string | null;
  traceId: string | null;
}

export interface McpDemoToken {
  accessToken: string;
  expiresAt: string;
  scopes: string[];
}

export class McpClientError extends Error {}

@Injectable({ providedIn: 'root' })
export class McpClient {
  private readonly http = inject(HttpClient);
  private nextId = 1;

  requestDemoToken(): Observable<McpDemoToken> {
    return this.http.post<McpDemoToken>('/mcp/demo-token', {}).pipe(
      map((response) => {
        if (typeof response?.accessToken !== 'string' || !response.accessToken) {
          throw new McpClientError('O servidor não retornou um token de demonstração válido.');
        }
        return response;
      }),
      catchError((error: unknown) => throwError(() => {
        if (error instanceof McpClientError) return error;
        if (error instanceof HttpErrorResponse && error.status === 429) {
          return new McpClientError('Limite de tokens atingido. Aguarde um minuto e tente novamente.');
        }
        if (error instanceof HttpErrorResponse && error.status === 404) {
          return new McpClientError('Token de demonstração indisponível neste ambiente.');
        }
        return new McpClientError('Não foi possível obter um token de demonstração.');
      })),
    );
  }

  call<T>(tool: McpToolName, args: Record<string, string | number>, token: string): Observable<McpToolResult<T>> {
    const accessToken = token.trim();
    if (!accessToken) {
      return throwError(() => new McpClientError('Informe um token JWT para executar a tool.'));
    }

    const request = {
      jsonrpc: '2.0',
      id: this.nextId++,
      method: 'tools/call',
      params: { name: tool, arguments: args },
    };
    const headers = new HttpHeaders({
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json, text/event-stream',
      'MCP-Protocol-Version': '2025-11-25',
    });

    return this.http.post('/mcp', request, { headers, responseType: 'text' }).pipe(
      map((body) => parseMcpResult<T>(body, request.id)),
      catchError((error: unknown) => throwError(() => {
        if (error instanceof McpClientError) return error;
        if (error instanceof HttpErrorResponse) {
          if (error.status === 401) return new McpClientError('Token inválido ou expirado.');
          if (error.status === 403) return new McpClientError('O token não autoriza esta tool.');
          if (error.status === 429) return new McpClientError('Limite de chamadas atingido. Aguarde um minuto e tente novamente.');
          return new McpClientError('Não foi possível acessar o servidor MCP.');
        }
        return new McpClientError('Não foi possível interpretar a resposta MCP.');
      })),
    );
  }
}

function parseMcpResult<T>(body: string, expectedId: number): McpToolResult<T> {
  let payload: unknown;
  try {
    if (body.trimStart().startsWith('{')) {
      payload = JSON.parse(body);
    } else {
      const events = body.split(/\r?\n/).filter((line) => line.startsWith('data:'));
      for (const event of events) {
        try {
          const message: unknown = JSON.parse(event.slice(5).trim());
          if (isRecord(message) && message['id'] === expectedId) {
            payload = message;
            break;
          }
        } catch {
          // Ignore unrelated SSE events; only the matching JSON-RPC response matters.
        }
      }
    }
  } catch {
    throw new McpClientError('Não foi possível interpretar a resposta MCP.');
  }

  if (!isRecord(payload) || payload['jsonrpc'] !== '2.0' || payload['id'] !== expectedId || !isRecord(payload['result'])) {
    throw new McpClientError('A chamada MCP não pôde ser concluída. Confira o escopo do token.');
  }
  const result = payload['result'];
  if (result['isError'] === true || !isRecord(result['structuredContent'])) {
    throw new McpClientError('A tool MCP não pôde ser executada. Confira o escopo do token.');
  }
  const content = result['structuredContent'];
  if (typeof content['status'] !== 'string') {
    throw new McpClientError('A resposta MCP não contém um resultado válido.');
  }
  return {
    status: content['status'],
    data: (content['data'] ?? null) as T | null,
    error: typeof content['error'] === 'string' ? content['error'] : null,
    traceId: typeof content['traceId'] === 'string' ? content['traceId'] : null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
