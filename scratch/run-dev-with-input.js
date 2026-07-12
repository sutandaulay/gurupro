const { spawn } = require('child_process');

console.log("Spawning dev server with reactive prompt responder...");
const child = spawn('npx', ['next', 'dev', '--webpack'], {
  cwd: 'd:\\gurupro',
  shell: true,
  env: {
    ...process.env,
    NODE_OPTIONS: '--max-old-space-size=4096'
  }
});

child.stdout.on('data', (data) => {
  const output = data.toString();
  process.stdout.write(output);

  // Detect Drizzle Kit prompt
  if (output.includes('table created or renamed') || output.includes('table will be created') || output.includes('Is ') && output.includes('table created')) {
    console.log("\n[Autoreply] Detected Drizzle prompt. Sending carriage return...");
    child.stdin.write("\r");
  }
});

child.stderr.on('data', (data) => {
  process.stderr.write(data.toString());
});

// Trigger curl after 18 seconds to start compilation
setTimeout(() => {
  console.log("\n[Autoreply] Triggering CMS compilation via curl...");
  const { exec } = require('child_process');
  exec('curl http://localhost:3000/cms', (err, stdout, stderr) => {
    console.log("\n[Autoreply] Curl completed.");
  });
}, 18000);

// Keep script running, let it exit when child exits or manual kill
child.on('close', (code) => {
  console.log(`\nChild process exited with code ${code}`);
  process.exit(code);
});
