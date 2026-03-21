/**
 * Rigrow User Onboarding Script
 * 
 * Reads a CSV file of new users and their field configurations,
 * then generates:
 *   1. user-data/<userId>/user_config.json for each user
 *   2. Updates user-data/user_registry.json with phone-to-userId mappings
 * 
 * Usage:
 *   node onboard.js                     (uses sample_users.csv by default)
 *   node onboard.js my_users.csv        (uses a custom CSV file)
 *   node onboard.js --dry-run           (preview without writing files)
 *   node onboard.js my_users.csv --dry-run
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ─── Paths ───────────────────────────────────────────────────────────────────
const REPO_ROOT = path.resolve(__dirname, '..');
const USER_DATA_DIR = path.join(REPO_ROOT, 'user-data');
const REGISTRY_PATH = path.join(USER_DATA_DIR, 'user_registry.json');

// ─── CSV Parser (no dependencies) ───────────────────────────────────────────
function parseCsv(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
  
  if (lines.length < 2) {
    throw new Error('CSV file must have a header row and at least one data row.');
  }

  const headers = lines[0].split(',').map(h => h.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const row = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] || '';
    });
    rows.push(row);
  }

  return rows;
}

// ─── Build user_config objects from CSV rows ────────────────────────────────
function buildUserConfigs(rows) {
  const usersMap = new Map();

  for (const row of rows) {
    const userId = row.userId;
    if (!userId) {
      console.warn('⚠  Skipping row with missing userId:', row);
      continue;
    }

    if (!usersMap.has(userId)) {
      usersMap.set(userId, {
        userId: userId,
        phoneNr: row.phoneNr || '',
        projectId: row.projectId || 'A1',
        language: row.language || 'en',
        calendarType: row.calendarType || 'INTL',
        datePickerType: row.datePickerType || 'INTL',
        fields: []
      });
    }

    const user = usersMap.get(userId);

    // Build the field entry
    const field = {
      id: crypto.randomUUID(),
      name: row.fieldName || 'Unnamed Field',
      A: parseFloat(row.A) || 0,
      q: parseFloat(row.q) || 0
    };

    // Drip fields have 'type' and 'efficiency'
    if (row.type && row.type.toLowerCase() === 'drip') {
      field.type = 'Drip';
      field.efficiency = parseInt(row.efficiency, 10) || 90;
    } else {
      // Non-drip fields use lf, sf, nf
      if (row.lf) field.lf = parseFloat(row.lf);
      if (row.sf) field.sf = parseFloat(row.sf);
      if (row.nf) field.nf = parseFloat(row.nf);
    }

    user.fields.push(field);
  }

  return usersMap;
}

// ─── Update user_registry.json ──────────────────────────────────────────────
function updateRegistry(usersMap, dryRun) {
  let registry = {};
  if (fs.existsSync(REGISTRY_PATH)) {
    registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8'));
  }

  let addedCount = 0;
  for (const [userId, config] of usersMap) {
    if (config.phoneNr && !registry[config.phoneNr]) {
      registry[config.phoneNr] = userId;
      addedCount++;
    }
  }

  if (!dryRun) {
    fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2) + '\n', 'utf-8');
  }

  return { registry, addedCount };
}

// ─── Write user_config.json files ───────────────────────────────────────────
function writeUserConfigs(usersMap, dryRun) {
  const results = [];

  for (const [userId, config] of usersMap) {
    // The path provided for user data will have a folder created using the userId
    const userDir = path.join(USER_DATA_DIR, userId);
    const configPath = path.join(userDir, 'user_config.json');

    let existed = false;
    if (fs.existsSync(configPath)) {
      existed = true;
    }

    if (!dryRun) {
      // If the folder doesn't exist, we create it (no need to recreate if it exists)
      if (!fs.existsSync(userDir)) {
        fs.mkdirSync(userDir, { recursive: true });
      }
      // Write the file (will create or replace if it already exists)
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
    }

    if (existed) {
      results.push({ 
        userId, 
        status: dryRun ? 'WOULD OVERWRITE (Warning: file already exists)' : 'OVERWRITTEN (Warning: file already existed)', 
        path: configPath 
      });
    } else {
      results.push({ 
        userId, 
        status: dryRun ? 'WOULD CREATE' : 'CREATED', 
        path: configPath 
      });
    }
  }

  return results;
}

// ─── Main ───────────────────────────────────────────────────────────────────
function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const csvArg = args.find(a => !a.startsWith('--'));
  const csvFile = csvArg
    ? path.resolve(csvArg)
    : path.join(__dirname, 'sample_users.csv');

  console.log('╔══════════════════════════════════════════════╗');
  console.log('║       Rigrow User Onboarding Script         ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log();

  if (dryRun) {
    console.log('🔍 DRY RUN MODE — no files will be written.\n');
  }

  // 1. Parse CSV
  if (!fs.existsSync(csvFile)) {
    console.error(`❌ CSV file not found: ${csvFile}`);
    process.exit(1);
  }
  console.log(`📄 Reading CSV: ${csvFile}`);
  const rows = parseCsv(csvFile);
  console.log(`   Found ${rows.length} row(s).\n`);

  // 2. Build configs
  const usersMap = buildUserConfigs(rows);
  console.log(`👤 Parsed ${usersMap.size} unique user(s):\n`);

  for (const [userId, config] of usersMap) {
    console.log(`   • ${userId} (${config.phoneNr}) — ${config.fields.length} field(s)`);
    for (const f of config.fields) {
      const typeInfo = f.type ? `${f.type}, eff=${f.efficiency}%` : `lf=${f.lf}, sf=${f.sf}, nf=${f.nf}`;
      console.log(`     └─ ${f.name}: A=${f.A}, q=${f.q}, ${typeInfo}`);
    }
  }
  console.log();

  // 3. Write user_config.json files
  console.log('📁 Writing user_config.json files:');
  const results = writeUserConfigs(usersMap, dryRun);
  for (const r of results) {
    const icon = r.status.includes('SKIP') ? '⏭️ ' : '✅';
    console.log(`   ${icon} ${r.userId}: ${r.status}`);
  }
  console.log();

  // 4. Update registry
  console.log('📋 Updating user_registry.json:');
  const { addedCount } = updateRegistry(usersMap, dryRun);
  console.log(`   ${addedCount > 0 ? '✅' : 'ℹ️ '} ${addedCount} new phone mapping(s) added.`);
  console.log();

  console.log('🎉 Done!');
}

main();
