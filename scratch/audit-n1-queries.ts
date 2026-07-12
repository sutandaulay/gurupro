import fs from 'fs';
import path from 'path';

const SEARCH_DIRS = ['d:\\gurupro\\app\\api', 'd:\\gurupro\\lib'];

interface N1Finding {
  filePath: string;
  line: number;
  snippet: string;
  type: string;
}

function scanDir(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      scanDir(filePath, fileList);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

function auditFile(filePath: string): N1Finding[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const findings: N1Finding[] = [];

  // Simple state machine or regex to detect query inside loops
  // 1. Detect standard loops (for, while)
  // 2. Detect array iterators (map, forEach, reduce)
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Look for map/forEach/for followed by await query
    if (line.includes('await query(') || line.includes('await pool.query(') || line.includes('await prisma.')) {
      // Check if this line or recent lines suggest we are inside a loop
      let isInsideLoop = false;
      let loopSnippet = '';
      
      // Look back up to 20 lines to see if there is an active loop or iterator block
      const startLookBack = Math.max(0, i - 20);
      const context = lines.slice(startLookBack, i + 1).join('\n');
      
      const loopPatterns = [
        /for\s*\(\s*(const|let|var)?\s+\w+\s+(of|in|;)\s*/,
        /while\s*\(/,
        /\.map\s*\(\s*async\s*\(/,
        /\.forEach\s*\(\s*async\s*\(/,
        /Promise\.all\(\s*\w+\.map\s*\(\s*async\s*\(/
      ];

      for (const pattern of loopPatterns) {
        if (pattern.test(context)) {
          // If it matches Promise.all( ... .map), it might execute concurrently, which is better than serial N+1, but still N queries.
          // Let's flag standard serial loops first.
          const isPromiseAll = /Promise\.all/.test(context);
          if (!isPromiseAll) {
            isInsideLoop = true;
            loopSnippet = line.trim();
            break;
          }
        }
      }

      if (isInsideLoop) {
        findings.push({
          filePath,
          line: i + 1,
          snippet: loopSnippet,
          type: 'Serial query inside loop (N+1 query problem)',
        });
      }
    }
  }

  return findings;
}

function runAudit() {
  const files: string[] = [];
  SEARCH_DIRS.forEach(dir => scanDir(dir, files));
  console.log(`Scanning ${files.length} files for N+1 queries...`);

  const allFindings: N1Finding[] = [];
  files.forEach(file => {
    const fileFindings = auditFile(file);
    allFindings.push(...fileFindings);
  });

  console.log(`\n=== FOUND ${allFindings.length} POTENTIAL N+1 QUERY PROBLEMS ===`);
  allFindings.forEach(f => {
    console.log(`- File: ${path.relative('d:\\gurupro', f.filePath)}:L${f.line}`);
    console.log(`  Code: ${f.snippet}`);
  });

  // Save detailed findings to JSON
  fs.writeFileSync('d:\\gurupro\\scratch\\n1_audit_results.json', JSON.stringify(allFindings, null, 2));
  console.log('\nAudit complete. Full results written to scratch/n1_audit_results.json');
}

runAudit();
