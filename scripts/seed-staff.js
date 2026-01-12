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

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase credentials in .env file');
  console.error('   Required: VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY');
  process.exit(1);
}

const functionUrl = `${SUPABASE_URL}/functions/v1/seed-test-users`;

console.log('🌱 Seeding test users...\n');

const options = {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json'
  }
};

const req = https.request(functionUrl, options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const result = JSON.parse(data);

      if (result.success) {
        console.log('✅ Seed function executed successfully\n');
        result.results.forEach(user => {
          const icon = user.status === 'created' ? '✨' :
                      user.status === 'already exists' ? '📌' : '❌';
          console.log(`${icon} ${user.email} - ${user.status}`);
        });
        console.log('\n📝 Login credentials:');
        console.log('   admin@boxemaster.pt / admin123');
        console.log('   staff@boxemaster.pt / staff123');
        console.log('   owner@boxemaster.pt / owner123');
        console.log('   partner@boxemaster.pt / partner123\n');
      } else {
        console.error('❌ Seed function failed:', result.error);
        process.exit(1);
      }
    } catch (e) {
      console.error('❌ Failed to parse response:', data);
      process.exit(1);
    }
  });
});

req.on('error', (e) => {
  console.error('❌ Request failed:', e.message);
  process.exit(1);
});

req.end();
