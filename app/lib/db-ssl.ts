// How the app's database connection uses TLS (app/lib/db.ts). The `postgres`
// library takes 'require' as "encrypt, but accept any certificate", and its `ssl`
// option overrides the URL's `sslmode`. On Vercel (which sets VERCEL=1) the server
// is Neon, whose certificate a public authority signed: there the certificate and
// the host name are checked ('verify-full'). The development and CI servers use
// self-signed certificates, so elsewhere the connection is encrypted unchecked.
export function databaseSsl(
  env: Record<string, string | undefined> = process.env
): 'verify-full' | 'require' {
  return env.VERCEL === '1' ? 'verify-full' : 'require';
}
