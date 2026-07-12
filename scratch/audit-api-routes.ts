import fs from 'fs';
import path from 'path';

const API_DIR = 'd:\\gurupro\\app\\api';

interface AuditResult {
  routePath: string;
  hasAuthCheck: boolean;
  authMethod: string;
  hasRoleCheck: boolean;
  roleCheckDetail: string;
  hasZodValidation: boolean;
  hasRawQuery: boolean;
  potentialVulnerabilities: string[];
}

function scanDir(dir: string, fileList: string[] = []): string[] {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      scanDir(filePath, fileList);
    } else if (file === 'route.ts' || file === 'route.js') {
      fileList.push(filePath);
    }
  }
  return fileList;
}

function auditRoute(filePath: string): AuditResult {
  const content = fs.readFileSync(filePath, 'utf-8');
  const relPath = path.relative(API_DIR, filePath);

  const result: AuditResult = {
    routePath: relPath,
    hasAuthCheck: false,
    authMethod: 'None',
    hasRoleCheck: false,
    roleCheckDetail: '',
    hasZodValidation: false,
    hasRawQuery: false,
    potentialVulnerabilities: [],
  };

  // Check Auth
  if (content.includes('gurupro_session')) {
    result.hasAuthCheck = true;
    result.authMethod = 'gurupro_session cookie';
  } else if (content.includes('getServerSession')) {
    result.hasAuthCheck = true;
    result.authMethod = 'getServerSession';
  } else if (content.includes('requireSession')) {
    result.hasAuthCheck = true;
    result.authMethod = 'requireSession';
  } else if (content.includes('getSession')) {
    result.hasAuthCheck = true;
    result.authMethod = 'getSession';
  }

  // Exempt public/webhook/auth endpoints
  if (
    relPath.startsWith('auth\\') ||
    relPath.startsWith('public\\') ||
    relPath.startsWith('webhook\\') ||
    relPath.startsWith('opt-out\\') ||
    relPath.startsWith('landing-page\\') ||
    relPath.startsWith('pricing\\')
  ) {
    if (!result.hasAuthCheck) {
      result.authMethod = 'Exempt (Public/Webhook/Auth/Landing)';
      result.hasAuthCheck = true;
    }
  }

  // Check Role Checks
  if (content.includes('role') || content.includes('.role')) {
    const roleMatches = content.match(/role\s*(===|!==|==|!=)\s*['"`]([a-zA-Z0-9_]+)['"`]/g);
    if (roleMatches) {
      result.hasRoleCheck = true;
      result.roleCheckDetail = roleMatches.join(', ');
    }
  }

  // Check Zod Validation
  if (content.includes('zod') || content.includes('.safeParse') || content.includes('.parse(') || content.includes('z.')) {
    result.hasZodValidation = true;
  }

  // Check Raw Query in Drizzle or pg query
  if (content.includes('query(') || content.includes('sql`')) {
    result.hasRawQuery = true;
  }

  // Check SQL injection risk (concatenating string in raw query)
  if (result.hasRawQuery) {
    // Check if query contains string interpolation like query(`... ${...}`)
    const sqlConcatMatch = content.match(/query\s*\(\s*[`"']([^`"']*\$\{[^`"']+\}[^`"']*)+[`"']/);
    if (sqlConcatMatch) {
      result.potentialVulnerabilities.push('Potential SQL injection via raw query string interpolation');
    }
  }

  // Check horizontal privilege escalation (e.g. fetching database row using req param ID without verifying ownership)
  // Let's flag routes that use params/ids but don't seem to filter by userId or check user ownership.
  const hasIdParam = relPath.includes('[id]') || relPath.includes('[slug]');
  if (hasIdParam && result.hasAuthCheck && result.authMethod !== 'Exempt (Public/Webhook/Auth/Landing)') {
    const checksOwnership = content.includes('userId') || content.includes('user_id') || content.includes('owner') || content.includes('session.id') || content.includes('author');
    if (!checksOwnership) {
      result.potentialVulnerabilities.push('Potential Horizontal Privilege Escalation: uses param ID without obvious user ownership verification');
    }
  }

  // PII logging check
  if (content.includes('console.log') && (content.includes('email') || content.includes('phone') || content.includes('nama') || content.includes('nisn') || content.includes('nilai'))) {
    result.potentialVulnerabilities.push('Console logging may expose PII (email, phone, nama, nisn, or nilai)');
  }

  return result;
}

function runAudit() {
  const files = scanDir(API_DIR);
  console.log(`Found ${files.length} route files.`);
  
  const results = files.map(auditRoute);
  
  const noAuth = results.filter(r => !r.hasAuthCheck);
  console.log(`\n=== ROUTES WITHOUT AUTH CHECK (${noAuth.length}) ===`);
  noAuth.forEach(r => {
    console.log(`- ${r.routePath}`);
  });

  const vulnerabilities = results.filter(r => r.potentialVulnerabilities.length > 0);
  console.log(`\n=== ROUTES WITH POTENTIAL VULNERABILITIES (${vulnerabilities.length}) ===`);
  vulnerabilities.forEach(r => {
    console.log(`- ${r.routePath}`);
    r.potentialVulnerabilities.forEach(v => console.log(`  * ${v}`));
  });

  // Write detailed JSON to file
  fs.writeFileSync('d:\\gurupro\\scratch\\api_audit_results.json', JSON.stringify(results, null, 2));
  console.log('\nAudit complete. Full results written to scratch/api_audit_results.json');
}

runAudit();
