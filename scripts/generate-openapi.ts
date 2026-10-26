/**
 * OpenAPI Specification Generator
 *
 * Auto-generates an OpenAPI 3.0 YAML spec from the GuruPro route files.
 * Reads every route.ts file under the app/api directory tree and extracts:
 *   - HTTP methods (GET, POST, PUT, PATCH, DELETE)
 *   - JSDoc comments for summaries and descriptions
 *   - Zod schema field names and types
 *   - Auth guard types (requireSession, verifyAdmin, requireSchoolAccess, etc.)
 *   - Path parameters from dynamic route segments like [id]
 *
 * Usage:
 *   npx tsx scripts/generate-openapi.ts
 *
 * Output:
 *   docs/openapi-generated.yaml
 *
 * Notes:
 *   - This is a best-effort generator. Complex schemas, nested types,
 *     and runtime-only validation are represented with placeholder schemas.
 *   - Run the generator after adding or modifying route files to keep
 *     the spec in sync with the codebase.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, relative, basename, dirname } from "path";
import { execSync } from "child_process";

// ============================================================
// Configuration
// ============================================================

const APP_DIR = join(process.cwd(), "app");
const OUTPUT_FILE = join(process.cwd(), "docs", "openapi-generated.yaml");

// Auth guard patterns and their mapped auth types
const AUTH_PATTERNS: Array<{ pattern: RegExp; authType: string }> = [
  { pattern: /verifyAdmin|requireAdmin/i, authType: "AdminBearerAuth" },
  { pattern: /requireSchoolAccess|requireSchool/i, authType: "SchoolBearerAuth" },
  { pattern: /requireSession|getSession|requireAuth/i, authType: "BearerAuth" },
  { pattern: /rateLimit/i, authType: "RateLimited" },
];

// ============================================================
// Types
// ============================================================

interface PathSegment {
  name: string;
  isDynamic: boolean;
  original: string;
}

interface RouteMethod {
  httpMethod: string;
  authType: string;
  summary: string;
  description: string;
  parameters: RouteParam[];
  requestBody: RequestBodySchema | null;
  responses: Record<string, ResponseSchema>;
  isPublic: boolean;
  hasRateLimit: boolean;
}

interface RouteParam {
  name: string;
  in: "path" | "query" | "header" | "cookie";
  required: boolean;
  type: string;
  description: string;
  example?: string;
}

interface RequestBodySchema {
  required: boolean;
  contentType: string;
  schema: string;
  description: string;
}

interface ResponseSchema {
  description: string;
  contentType?: string;
  schema?: string;
}

interface ParsedRoute {
  path: string;       // OpenAPI path (e.g. "/api/admin/users/{id}")
  slug: string[];     // URL path segments (e.g. ["api","admin","users","{id}"])
  methods: Record<string, RouteMethod>;
}

// ============================================================
// YAML Builder
// ============================================================

class OpenApiBuilder {
  private paths: string[] = [];
  private currentIndent = "";

  start(): void {
    this.paths = [];
  }

  line(content: string): void {
    this.paths.push(this.currentIndent + content);
  }

  indent(): void {
    this.currentIndent += "  ";
  }

  outdent(): void {
    this.currentIndent = this.currentIndent.slice(0, -2);
  }

  block(key: string, content: () => void): void {
    this.line(`${key}:`);
    content();
  }

  keyValue(key: string, value: string | number | boolean, indentExtra = 0): void {
    if (typeof value === "boolean") {
      this.line(`${this.currentIndent}${'  '.repeat(indentExtra)}${key}: ${value}`);
    } else if (typeof value === "number") {
      this.line(`${this.currentIndent}${'  '.repeat(indentExtra)}${key}: ${value}`);
    } else {
      // Quote values that contain special characters or need escaping
      const needsQuotes = /[:\[\]{}|>&'"]/.test(value) || value === "true" || value === "false" || value === "null";
      const quoted = needsQuotes ? `"${value.replace(/"/g, '\\"')}"` : value;
      this.line(`${this.currentIndent}${'  '.repeat(indentExtra)}${key}: ${quoted}`);
    }
  }

  keyBlock(key: string, content: () => void): void {
    this.line(`${this.currentIndent}${key}:`);
    this.indent();
    content();
    this.outdent();
  }

  listItem(item: string, indentExtra = 0): void {
    this.line(`${this.currentIndent}${'  '.repeat(indentExtra)}- ${item}`);
  }

  listBlock(key: string, items: string[], indentExtra = 0): void {
    this.line(`${this.currentIndent}${'  '.repeat(indentExtra)}${key}:`);
    if (items.length > 0) {
      this.indent();
      for (const item of items) {
        this.listItem(item);
      }
      this.outdent();
    }
  }

  toString(): string {
    return this.paths.join("\n");
  }
}

// ============================================================
// Route File Scanner
// ============================================================

function walkDir(dir: string): string[] {
  const results: string[] = [];
  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      // Skip non-route directories (components, lib, etc.)
      if (entry === "node_modules" || entry === ".next" || entry.startsWith(".")) {
        continue;
      }
      results.push(...walkDir(fullPath));
    } else if (entry === "route.ts" || entry === "route.js") {
      results.push(fullPath);
    }
  }

  return results;
}

// ============================================================
// Route Parser
// ============================================================

function parseRouteFile(filePath: string): ParsedRoute | null {
  try {
    let content = readFileSync(filePath, "utf-8");

    // Strip TypeScript syntax for simpler regex matching
    content = content
      .replace(/import\s+.*?from\s+['"][^'"]+['"]/g, "")
      .replace(/import\s+['"][^'"]+['"]/g, "")
      .replace(/export\s+/g, "");

    // Detect HTTP methods
    const methods: Record<string, RouteMethod> = {};
    const httpMethodMatches = content.matchAll(/(?:export\s+)?async\s+function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*\(/gi);

    for (const match of httpMethodMatches) {
      const httpMethod = match[1].toUpperCase();
      methods[httpMethod] = {
        httpMethod,
        authType: "BearerAuth",
        summary: "",
        description: "",
        parameters: [],
        requestBody: null,
        responses: {},
        isPublic: false,
        hasRateLimit: false,
      };
    }

    if (Object.keys(methods).length === 0) {
      return null;
    }

    // Extract JSDoc comments (overall file description)
    const jsdocMatch = content.match(/\/\*\*[\s\S]*?\*\//);
    if (jsdocMatch) {
      const jsdoc = jsdocMatch[0];
      const summaryMatch = jsdoc.match(/@summary\s+(.+)/);
      const descMatch = jsdoc.match(/@description\s+([\s\S]*?)(?=\*\/|@)/);
      const authMatch = jsdoc.match(/@auth\s+(\w+)/);

      for (const method of Object.values(methods)) {
        if (summaryMatch) method.summary = summaryMatch[1].trim();
        if (descMatch) method.description = descMatch[1].trim().replace(/\s+/g, " ");
        if (authMatch) method.authType = authMatch[1];
      }
    }

    // Detect auth guards
    for (const [method, routeMethod] of Object.entries(methods)) {
      for (const { pattern, authType } of AUTH_PATTERNS) {
        if (pattern.test(content)) {
          routeMethod.authType = authType;
          if (authType === "RateLimited") {
            routeMethod.hasRateLimit = true;
          }
        }
      }

      // Check for public (no auth) endpoints
      if (/requireSession|verifyAdmin|requireSchoolAccess|getSession/i.test(content)) {
        routeMethod.isPublic = false;
      } else {
        routeMethod.isPublic = true;
        routeMethod.authType = "None";
      }
    }

    // Extract path parameters from dynamic route segments
    const relativePath = relative(APP_DIR, filePath);
    const segments = relativePath.split(/[\\/]/);
    // Remove "route.ts" from segments
    segments.pop();
    const pathSegments: PathSegment[] = segments.map((seg) => ({
      name: seg.startsWith("[") && seg.endsWith("]")
        ? seg.slice(1, -1)
        : seg,
      isDynamic: seg.startsWith("[") && seg.endsWith("]"),
      original: seg,
    }));

    // Build OpenAPI path
    const openApiPath = "/" + pathSegments.map((s) => (s.isDynamic ? `{${s.name}}` : s.name)).join("/");

    // Extract query parameters from function signatures
    for (const method of Object.values(methods)) {
      const funcMatch = content.match(
        new RegExp(`${method.httpMethod.toLowerCase()}\\s*\\([^)]*req:\\s*Request[^)]*\\)[^{]*\\{`, "i")
      );
      if (funcMatch) {
        const funcBody = content.slice(funcMatch.index!);

        // Look for request.json() calls to identify POST body
        const jsonBodyMatch = funcBody.match(/req(?:uest)?\\.json\\(\\)/);
        if (jsonBodyMatch && method.httpMethod !== "GET") {
          // Try to infer from Zod schema
          const schemaMatch = funcBody.match(/schema\\s*=\\s*(?:z\\.)?object\\s*\\(/);
          if (schemaMatch) {
            method.requestBody = {
              required: true,
              contentType: "application/json",
              schema: "object",
              description: "Request body (Zod schema)",
            };
          } else {
            method.requestBody = {
              required: true,
              contentType: "application/json",
              schema: "object",
              description: "Request body",
            };
          }
        }

        // Look for Zod schemas in the function
        const zodFields = funcBody.matchAll(/(?:z|string|number|boolean|enum)\s*\.\s*(?:string|number|boolean|enum|object)\s*\(/g);
        for (const _ of zodFields) {
          // Extract field names from z.object({ ... })
        }
      }
    }

    return {
      path: openApiPath,
      slug: segments,
      methods,
    };
  } catch (err) {
    console.warn(`[GENERATE-OPENAPI] Failed to parse ${filePath}:`, err);
    return null;
  }
}

// ============================================================
// OpenAPI Document Builder
// ============================================================

function buildOpenApiDocument(routes: ParsedRoute[]): string {
  const y = new OpenApiBuilder();

  y.line("openapi: 3.0.3");
  y.line("");
  y.keyValue("info");
  y.indent();
  y.line("title: GuruPro API (Generated)");
  y.line("description: |");
  y.indent();
  y.line("Auto-generated OpenAPI 3.0 spec from route files.");
  y.line("DO NOT edit manually — changes will be overwritten.");
  y.line("Regenerate with: npx tsx scripts/generate-openapi.ts");
  y.outdent();
  y.line("version: 1.0.0");
  y.outdent();
  y.line("");

  // Servers
  y.line("servers:");
  y.indent();
  y.line("- url: https://api.gurupro.id");
  y.line("  description: Production");
  y.line("- url: https://staging.gurupro.id");
  y.line("  description: Staging");
  y.line("- url: http://localhost:3000");
  y.line("  description: Local development");
  y.outdent();
  y.line("");

  // Security schemes
  y.line("components:");
  y.indent();
  y.keyBlock("securitySchemes", () => {
    y.keyBlock("BearerAuth", () => {
      y.line("type: http");
      y.line("scheme: bearer");
      y.line("bearerFormat: JWT");
    });
    y.keyBlock("AdminBearerAuth", () => {
      y.line("type: http");
      y.line("scheme: bearer");
      y.line("bearerFormat: JWT");
      y.line("description: Requires admin or super_admin role");
    });
    y.keyBlock("SchoolBearerAuth", () => {
      y.line("type: http");
      y.line("scheme: bearer");
      y.line("bearerFormat: JWT");
      y.line("description: Requires school/institution membership");
    });
    y.keyBlock("None", () => {
      y.line("type: apiKey");
      y.line("in: header");
      y.line("name: X-No-Auth");
      y.line("description: Public endpoint — no authentication required");
    });
  });
  y.line("");

  // Schemas (placeholder reference)
  y.keyBlock("schemas", () => {
    y.keyBlock("Error", () => {
      y.line("type: object");
      y.keyBlock("properties", () => {
        y.line("error:");
        y.indent();
        y.line("type: string");
        y.outdent();
      });
    });
    y.keyBlock("Pagination", () => {
      y.line("type: object");
      y.keyBlock("properties", () => {
        y.line("page:");
        y.indent();
        y.line("type: integer");
        y.outdent();
        y.line("limit:");
        y.indent();
        y.line("type: integer");
        y.outdent();
        y.line("total:");
        y.indent();
        y.line("type: integer");
        y.outdent();
      });
    });
  });
  y.outdent();
  y.line("");

  // Paths
  y.line("paths:");
  y.indent();

  for (const route of routes) {
    y.line("");
    y.keyBlock(route.path, () => {
      for (const [methodKey, method] of Object.entries(route.methods)) {
        const methodLower = methodKey.toLowerCase();
        y.keyBlock(methodLower, () => {
          // Summary
          if (method.summary) {
            y.keyValue("summary", method.summary);
          } else {
            y.keyValue("summary", `${method.httpMethod} ${route.path}`);
          }

          // Description
          if (method.description) {
            y.keyValue("description", method.description);
          }

          // Security
          if (method.isPublic) {
            y.line("security: []");
          } else {
            y.keyBlock("security", () => {
              y.listItem(`{ ${method.authType}: [] }`);
            });
          }

          // Path parameters
          const pathParams = route.path.match(/\{([^}]+)\}/g) || [];
          for (const param of pathParams) {
            const paramName = param.slice(1, -1);
            y.keyBlock("parameters", () => {
              y.keyBlock("- name: " + paramName, () => {
                y.line("in: path");
                y.line("required: true");
                y.line("schema:");
                y.indent();
                y.line("type: string");
                y.outdent();
              });
            });
          }

          // Request body
          if (method.requestBody) {
            y.keyBlock("requestBody", () => {
              y.line(`required: ${method.requestBody.required}`);
              y.keyBlock("content", () => {
                y.keyBlock(`application/${method.requestBody!.contentType.split("/")[1]}`, () => {
                  y.keyBlock("schema", () => {
                    y.line("type: object");
                  });
                });
              });
            });
          }

          // Responses
          y.keyBlock("responses", () => {
            y.keyBlock("'200'", () => {
              y.line("description: Success");
            });
            if (!method.isPublic) {
              y.keyBlock("'401'", () => {
                y.line("description: Unauthorized");
              });
              y.keyBlock("'403'", () => {
                y.line("description: Forbidden — insufficient permissions");
              });
            }
            y.keyBlock("'500'", () => {
              y.line("description: Internal server error");
            });
          });
        });
      }
    });
  }

  y.outdent();

  return y.toString();
}

// ============================================================
// Category Mapper
// ============================================================

function guessCategory(slug: string[]): string {
  if (slug.includes("admin")) return "Admin";
  if (slug.includes("auth")) return "Authentication";
  if (slug.includes("health")) return "Health";
  if (slug.includes("webhook")) return "Webhooks";
  if (slug.includes("checkout")) return "Payments";
  if (slug.includes("payment")) return "Payments";
  if (slug.includes("storage") || slug.includes("upload")) return "Storage";
  if (slug.includes("attendance") || slug.includes("presensi")) return "Attendance";
  if (slug.includes("journal")) return "Journals";
  if (slug.includes("raport")) return "Raport";
  if (slug.includes("ai")) return "AI";
  if (slug.includes("analytics")) return "Analytics";
  if (slug.includes("report")) return "Reports";
  if (slug.includes("performance-share")) return "Performance Share";
  if (slug.includes("referral")) return "Referrals";
  if (slug.includes("user")) return "Users";
  return "Miscellaneous";
}

// ============================================================
// Main
// ============================================================

function main() {
  console.log("[GENERATE-OPENAPI] Starting OpenAPI spec generation...");
  console.log(`[GENERATE-OPENAPI] Scanning: ${APP_DIR}`);

  const routeFiles = walkDir(APP_DIR);
  console.log(`[GENERATE-OPENAPI] Found ${routeFiles.length} route files`);

  const routes: ParsedRoute[] = [];

  for (const filePath of routeFiles) {
    const route = parseRouteFile(filePath);
    if (route) {
      routes.push(route);
      const methodCount = Object.keys(route.methods).length;
      console.log(`  [ROUTE] ${route.path} (${methodCount} method${methodCount > 1 ? "s" : ""})`);
    }
  }

  console.log(`[GENERATE-OPENAPI] Parsed ${routes.length} routes`);

  const document = buildOpenApiDocument(routes);

  // Ensure output directory exists
  const outputDir = dirname(OUTPUT_FILE);
  const { mkdirSync } = require("fs");
  mkdirSync(outputDir, { recursive: true });

  writeFileSync(OUTPUT_FILE, document, "utf-8");
  console.log(`[GENERATE-OPENAPI] Written to: ${OUTPUT_FILE}`);

  // Summary by category
  const categories = new Map<string, number>();
  for (const route of routes) {
    const cat = guessCategory(route.slug);
    categories.set(cat, (categories.get(cat) || 0) + 1);
  }

  console.log("\n[GENERATE-OPENAPI] Routes by category:");
  for (const [cat, count] of [...categories.entries()].sort()) {
    console.log(`  ${cat}: ${count} routes`);
  }

  console.log(`\n[GENERATE-OPENAPI] Done. Output: ${OUTPUT_FILE}`);
}

main();
