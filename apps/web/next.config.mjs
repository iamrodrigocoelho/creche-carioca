/**
 * PRD 13.5: configurar CSP, HSTS, X-Content-Type-Options, politica de referrer e
 * permissoes do navegador.
 *
 * `'unsafe-inline'` em `style-src` e uma concessao temporaria: o Next injeta
 * estilos criticos inline. A migracao para CSP baseada em nonce esta prevista na
 * Fase 14 (docs/DECISIONS.md, ADR-0010). Nenhuma origem externa e permitida -
 * fontes, imagens e scripts vem apenas do proprio dominio, o que tambem impede
 * o carregamento remoto de logotipos proibido pelo DESIGN.md.
 */
const staticMode = process.env.NEXT_PUBLIC_STATIC_MODE === 'true';
const apiOrigin = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';

// No modo estatico nao existe API para contatar: a jornada roda no navegador
// (ADR-0027). Manter a origem na CSP autorizaria uma conexao que nunca deveria
// acontecer, entao ela sai.
const connectSrc = staticMode ? "connect-src 'self'" : `connect-src 'self' ${apiOrigin}`;

const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  connectSrc,
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

/**
 * `output: 'export'` gera HTML estatico em `out/`, sem servidor Node.
 *
 * A exportacao estatica nao suporta `headers()` — quem serve os arquivos e o
 * servidor web da hospedagem. Os mesmos cabeçalhos sao emitidos no `.htaccess`
 * por `scripts/build-static.mjs`, e `securityHeaders` continua sendo a unica
 * fonte deles, para os dois modos nao divergirem.
 *
 * `images.unoptimized` e obrigatorio na exportacao: o otimizador de imagens do
 * Next precisa de servidor.
 *
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@match/ui', '@match/domain', '@match/schemas', '@match/geo'],
  ...(staticMode
    ? {
        output: 'export',
        images: { unoptimized: true },
        // Sem servidor para negociar `/rota` -> `/rota.html`, a hospedagem serve
        // melhor `/rota/index.html`.
        trailingSlash: true,
      }
    : {
        async headers() {
          return [{ source: '/:path*', headers: securityHeaders }];
        },
      }),
};

export { securityHeaders };

export default nextConfig;
