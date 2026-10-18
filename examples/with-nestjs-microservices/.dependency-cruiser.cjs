// Architecture rules, checked with `pnpm lint:boundaries`. Every app is its
// own deployable; the only code they share is `@example/contracts`.

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment: "Circular imports make module boundaries meaningless.",
      from: {},
      to: { circular: true },
    },
    {
      name: "no-cross-app-imports",
      severity: "error",
      comment:
        "Apps talk over HTTP, RPC or queues, never by importing each other. Move shared types to packages/contracts.",
      from: { path: "^apps/([^/]+)/" },
      to: { path: "^apps/", pathNot: "^apps/$1/" },
    },
    {
      name: "contracts-stay-dependency-free",
      severity: "error",
      comment:
        "The shared kernel is imported by the browser-facing app and every service, so it may only depend on zod.",
      from: { path: "^packages/contracts/" },
      to: {
        dependencyTypes: ["npm", "npm-dev", "npm-optional", "npm-peer"],
        pathNot: "[/]zod[/]",
      },
    },
    {
      name: "contracts-do-not-import-apps",
      severity: "error",
      from: { path: "^packages/" },
      to: { path: "^apps/" },
    },
    {
      name: "web-has-no-backend-dependencies",
      severity: "error",
      comment:
        "The Next.js app is a backend-for-frontend: it calls the gateway over HTTP and never embeds Nest, BullMQ or Redis clients.",
      from: { path: "^apps/web/" },
      to: { path: "[/](@nestjs|bullmq|ioredis)[/]" },
    },
    {
      name: "services-have-no-frontend-dependencies",
      severity: "error",
      from: { path: "^apps/(gateway|orders|worker)/" },
      to: { path: "[/](next|react|react-dom)[/]" },
    },
    {
      name: "not-to-unresolvable",
      severity: "error",
      from: {},
      to: { couldNotResolve: true },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: "(^|/)(dist|\\.next)/" },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.base.json" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
    },
  },
};
