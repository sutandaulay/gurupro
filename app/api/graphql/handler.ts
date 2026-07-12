'use strict';
import { GraphQLSchema } from 'graphql';

export async function GETGraphQLSchema(payloadConfig) {
  const localSchema = await payloadConfig().then(config => config.schema);
  return localSchema as GraphQLSchema;
}

export async function CREATEServer(options) {
  const {
    schema,
    req,
    api,
    handler,
    context,
    extensions
  } = options;

  const func = handler({
    schema: () => schema
  });

  return async function (req, res) {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      url.search = req.url.split('?')[1];

      const result = await func({ req: {
        body: req.body,
        headers: req.headers,
        method: req.method,
        url: url.toString(),
        searchParams: new URLSearchParams(url.search),
        query: new URLSearchParams(url.search),
        params: req.params,
        pathname: url.pathname,
        protocol: url.protocol,
        httpVersion: req.httpVersion,
        aborted: false
      } });

      Object.entries(result.headers).forEach(([key, value]) => {
        res.setHeader(key, value);
      });

      if (result.status !== 200) {
        res.writeHead(result.status);
      }

      if (result.body !== null && result.body !== undefined) {
        if (result.body instanceof ReadableStream) {
          result.body.pipeTo(res.writable);
          return;
        }

        if (typeof result.body === 'string' || Buffer.isBuffer(result.body)) {
          res.end(result.body);
          return;
        }

        if (typeof result.body === 'object') {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(result.body));
          return;
        }
      }

      res.end();
    } catch (error) {
      console.error('GraphQL Handler Error:', error);
      res.writeHead(500);
      res.end(JSON.stringify({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
  };
}

export async function CREATEGraphQLHandler(options) {
  const {
    schema,
    context,
    extensions
  } = options;

  const handler = await import('graphql-http/lib/use/fetch');
  const parseRequestParams = handler.parseRequestParams;

  async function onRequest(req, reqCtx) {
    try {
      const { query, variables, operationName } = parseRequestParams(req, {
        ...reqCtx,
        Response: globalThis.Response,
        TextEncoder: globalThis.TextEncoder,
        ReadableStream: globalThis.ReadableStream
      });

      const result = await graphqlExecute(schema, {
        query,
        variables,
        operationName
      });

      const headers = new Map();
      headers.set('Content-Type', 'application/json');

      const status = (result.extensions && result.extensions.http && result.extensions.http.status) || 200;

      return {
        body: JSON.stringify(result),
        headers,
        status
      };
    } catch (error) {
      console.error('GraphQL Parse Handler Error:', error);
      return new globalThis.Response(JSON.stringify({
        error: 'Bad Request',
        message: error instanceof Error ? error.message : 'Invalid GraphQL request'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  return async function (req, res) {
    try {
      if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.statusCode = 200;
        res.end();
        return;
      }

      if (req.method === 'POST' && req.url.includes('/graphql')) {
        const reqCtx = {
          req,
          body: JSON.parse(await new Promise(resolve => req.once('data', resolve)) || '{}'),
          headers: req.headers,
          method: req.method,
          url: req.url
        };

        const response = await onRequest(req, reqCtx);

        if (response instanceof globalThis.Response) {
          res.statusCode = response.status || 200;
          response.headers.forEach((value, key) => {
            res.setHeader(key, value);
          });

          const body = await response.text();
          if (body) {
            res.end(body);
          }
        } else {
          res.statusCode = response.status || 200;
          response.headers.forEach((value, key) => {
            res.setHeader(key, value);
          });
          res.end(response.body);
        }
      } else if (req.method === 'GET' && req.url.includes('/graphql')) {
        const url = new URL(req.url);
        const query = url.searchParams.get('query');
        const variables = url.searchParams.get('variables') ? JSON.parse(url.searchParams.get('variables')) : undefined;

        const result = await graphqlExecute(schema, {
          query,
          variables
        });

        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(result));
      } else {
        res.statusCode = 404;
        res.end(JSON.stringify({
          error: 'Not Found',
          path: req.url
        }));
      }
    } catch (error) {
      console.error('GraphQL Handler Error:', error);
      res.statusCode = 500;
      res.end(JSON.stringify({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
  };
}
