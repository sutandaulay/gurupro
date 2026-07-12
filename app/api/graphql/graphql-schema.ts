export async function GETGraphQLSchema() {
  try {
    const config = await import('@/payload.config');
    const schema = config.schema;

    if (!schema || !(schema instanceof Function)) {
      throw new Error('GraphQL schema not found in payload config');
    }

    return await schema();
  } catch (error) {
    console.error('Error loading GraphQL schema:', error);
    throw error;
  }
}
