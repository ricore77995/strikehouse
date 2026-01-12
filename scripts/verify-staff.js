#!/usr/bin/env node
import https from 'https';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Read .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '..', '.env');

let SUPABASE_URL, SUPABASE_KEY;

try {
  const envContent = readFileSync(envPath, 'utf8');
  const envVars = {};

  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=:#]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      envVars[key] = value;
    }
  });

  SUPABASE_URL = envVars.VITE_SUPABASE_URL;
  SUPABASE_KEY = envVars.VITE_SUPABASE_PUBLISHABLE_KEY;
} catch (error) {
  console.error('❌ Failed to read .env file:', error.message);
  process.exit(1);
}

const queryUrl = `${SUPABASE_URL}/rest/v1/staff?select=email,nome,role,ativo`;

console.log('🔍 Checking staff table...\n');

const options = {
  headers: {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`
  }
};

https.get(queryUrl, options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const staff = JSON.parse(data);

      if (staff.length === 0) {
        console.log('⚠️  Staff table is empty. Run: npm run seed\n');
      } else {
        console.log(`✅ Found ${staff.length} staff members:\n`);
        staff.forEach(s => {
          const status = s.ativo ? '🟢' : '🔴';
          console.log(`${status} ${s.email} (${s.role})`);
        });
        console.log('');
      }
    } catch (e) {
      console.error('❌ Failed to parse response:', data);
    }
  });
}).on('error', (e) => {
  console.error('❌ Request failed:', e.message);
});
