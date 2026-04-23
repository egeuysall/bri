function getRequiredEnv(name: 'CLERK_JWT_ISSUER_DOMAIN'): string {
  const value = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export default {
  providers: [
    {
      domain: getRequiredEnv('CLERK_JWT_ISSUER_DOMAIN'),
      applicationID: 'convex',
    },
  ],
};
