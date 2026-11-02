#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function generateSalt() {
  return crypto.randomBytes(32).toString('hex');
}

function generateEnvFile(environment = 'development') {
  const envPath = path.join(__dirname, '..', `.env.${environment}`);
  const examplePath = path.join(__dirname, '..', '.env.example');
  
  if (!fs.existsSync(examplePath)) {
    console.error('Error: .env.example file not found');
    process.exit(1);
  }
  
  let envContent = fs.readFileSync(examplePath, 'utf8');
  
  // Generate unique salts
  const apiKeySalt = generateSalt();
  const hashSalt = generateSalt();
  
  // Replace placeholders
  envContent = envContent.replace('YOUR_UNIQUE_API_KEY_SALT_HERE', apiKeySalt);
  envContent = envContent.replace('YOUR_UNIQUE_HASH_SALT_HERE', hashSalt);
  envContent = envContent.replace('ENVIRONMENT=development', `ENVIRONMENT=${environment}`);
  
  // Set appropriate API URL based on environment
  if (environment === 'production') {
    envContent = envContent.replace('API_BASE_URL=http://localhost:8787', 'API_BASE_URL=https://api.deadlink.io');
  } else if (environment === 'staging') {
    envContent = envContent.replace('API_BASE_URL=http://localhost:8787', 'API_BASE_URL=https://staging-api.deadlink.io');
  }
  
  fs.writeFileSync(envPath, envContent);
  console.log(`Generated ${envPath} with secure salts`);
  console.log('API_KEY_SALT:', apiKeySalt);
  console.log('HASH_SALT:', hashSalt);
  console.log('\nIMPORTANT: Store these values securely and never commit them to version control!');
}

// Parse command line arguments
const environment = process.argv[2] || 'development';
generateEnvFile(environment);