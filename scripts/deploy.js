#!/usr/bin/env node

/**
 * FTP Deploy Script for produktfotostudio.at
 * Uses basic-ftp with explicit FTPS (TLS on port 21)
 * and bypasses certificate hostname mismatch.
 */

import { Client } from 'basic-ftp';

async function deploy() {
  const host = process.env.FTP_HOST;
  const user = process.env.FTP_USER;
  const pass = process.env.FTP_PASS;

  if (!host || !user || !pass) {
    console.error('❌ Missing FTP_HOST, FTP_USER, or FTP_PASS environment variables.');
    process.exit(1);
  }

  const client = new Client();
  client.ftp.verbose = true;

  try {
    console.log(`🔌 Connecting to ${host}...`);

    await client.access({
      host: host,
      port: 21,
      user: user,
      password: pass,
      secure: true,
      secureOptions: { rejectUnauthorized: false },
    });

    console.log('✅ Connected successfully!');

    console.log('📂 Navigating to produktfotostudio.at/web/...');
    await client.ensureDir('produktfotostudio.at/web/');

    console.log('📤 Uploading dist/ contents...');
    await client.uploadFromDir('dist/');

    console.log('🎉 Deploy complete!');
  } catch (err) {
    console.error('❌ Deploy failed:', err.message);
    process.exit(1);
  } finally {
    client.close();
  }
}

deploy();
