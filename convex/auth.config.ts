function getRequiredEnv(name: 'CLERK_JWT_ISSUER_DOMAIN'): string {
  const value = process.env[name];
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
