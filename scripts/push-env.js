const fs = require('fs');
const { execSync } = require('child_process');

const envFile = fs.readFileSync('.env', 'utf8');
const lines = envFile.split('\n');

const envs = ['production', 'preview', 'development'];

for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;

  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) continue;

  const key = trimmed.substring(0, eqIdx);
  let value = trimmed.substring(eqIdx + 1);

  // Clean quotes
  if (value.startsWith('"') && value.endsWith('"')) {
    value = value.substring(1, value.length - 1);
  }

  // Fix DATABASE_URL specific issue (psql 'url')
  if (key === 'DATABASE_URL' && value.startsWith('psql ')) {
    // Extract url from: psql 'postgresql://...'
    const match = value.match(/psql '([^']+)'/);
    if (match) {
      value = match[1];
      console.log(`Fixed DATABASE_URL format.`);
    }
  }

  console.log(`Pushing ${key}...`);

  for (const env of envs) {
    try {
      // Use printf to handle special characters safely and pipe to vercel env add
      // We use --force to overwrite if exists
      // Check if variable exists first? No, --force should handle it or we catch error
      // Actually vercel env add doesn't have --force for overwriting values, it says "Override an existing... $ vercel env add API_TOKEN --force"
      // So yes, it has --force.
      
      // Construct command: echo -n "value" | vercel env add KEY env --force
      // We need to escape value for shell if we use echo.
      // Better to write value to a temp file or pass via stdin using node's execSync input option.
      
      execSync(`npx vercel env add ${key} ${env} --force`, {
        input: value,
        stdio: ['pipe', 'inherit', 'inherit'] // pipe stdin, inherit stdout/stderr
      });
    } catch (e) {
      // Ignore error if it's just user cancelling or something, but with force it should work.
      // If it fails, it might be because of login or permissions.
      console.error(`Failed to push ${key} to ${env}`);
    }
  }
}
