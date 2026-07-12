import { CREATEGraphQLHandler } from './handler';
import { GETGraphQLSchema } from './graphql-schema';

export const GET = async (req, res) => {
  try {
    const schema = await GETGraphQLSchema();
    const handler = await CREATEGraphQLHandler({ schema });
    return handler(req, res);
  } catch (error) {
    console.error('GraphQL GET Handler Error:', error);
    res.statusCode = 500;
    res.end(JSON.stringify({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to load GraphQL schema'
    }));
  }
};

export const POST = async (req, res) => {
  try {
    const schema = await GETGraphQLSchema();
    const handler = await CREATEGraphQLHandler({ schema });
    return handler(req, res);
  } catch (error) {
    console.error('GraphQL POST Handler Error:', error);
    res.statusCode = 500;
    res.end(JSON.stringify({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to load GraphQL schema'
    }));
  }
};
