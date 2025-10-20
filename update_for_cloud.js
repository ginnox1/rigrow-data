const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Promisify readline question
const question = (query) => new Promise((resolve) => rl.question(query, resolve));

// Parse date from DDMMYY format
const parseDateFromDDMMYY = (dateStr) => {
  if (dateStr.length !== 6) {
    throw new Error('Date must be in DDMMYY format (6 digits)');
  }
  
  const day = parseInt(dateStr.substring(0, 2), 10);
  const month = parseInt(dateStr.substring(2, 4), 10);
  const year = 2000 + parseInt(dateStr.substring(4, 6), 10);
  
  // Validate date components
  if (day < 1 || day > 31) throw new Error('Invalid day');
  if (month < 1 || month > 12) throw new Error('Invalid month');
  if (year < 2000 || year > 2099) throw new Error('Invalid year');
  
  return new Date(year, month - 1, day);
};

// Format date as YYYYMMDD
const formatDateYYYYMMDD = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
};

// Format date as YYYY-MM-DD
const formatDateYYYYMMDDDash = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Generate date mappings for 31 days ending on endDate
const generateDateMappings = (endDate, existingFolders) => {
  const mappings = [];
  const sortedFolders = existingFolders.sort();
  
  // Start 30 days before end date (31 days total including end date)
  for (let i = 0; i < sortedFolders.length; i++) {
    const date = new Date(endDate);
    date.setDate(endDate.getDate() - (sortedFolders.length - 1 - i));
    
    mappings.push({
      oldFolder: sortedFolders[i],
      newFolder: formatDateYYYYMMDD(date),
      newDate: formatDateYYYYMMDDDash(date)
    });
  }
  
  return mappings;
};

// Get all date folders in a directory
const getDateFolders = (dir) => {
  const items = fs.readdirSync(dir);
  return items.filter(item => {
    const itemPath = path.join(dir, item);
    const isDir = fs.statSync(itemPath).isDirectory();
    const isDateFolder = /^\d{8}$/.test(item); // 8 digits
    return isDir && isDateFolder;
  });
};

// Main update function
const updateCloudData = (datasetPath, endDate) => {
  console.log('\n' + '='.repeat(60));
  console.log('Cloud Data Date Update Tool - Standalone Mode');
  console.log('='.repeat(60));
  console.log(`Working Directory: ${datasetPath}`);
  console.log(`End Date: ${formatDateYYYYMMDDDash(endDate)}`);
  console.log('='.repeat(60) + '\n');
  
  // Get existing folders
  const existingFolders = getDateFolders(datasetPath);
  if (existingFolders.length === 0) {
    throw new Error('No date folders found in the directory');
  }
  
  console.log(`Found ${existingFolders.length} date folders to process\n`);
  
  const mappings = generateDateMappings(endDate, existingFolders);
  
  // Display date range
  console.log(`Date Range: ${mappings[0].newDate} to ${mappings[mappings.length - 1].newDate}`);
  console.log(`Total Days: ${mappings.length}\n`);
  
  // Step 1: Rename to temporary names
  console.log('Step 1: Renaming folders to temporary names...');
  mappings.forEach(mapping => {
    const oldPath = path.join(datasetPath, mapping.oldFolder);
    const tempPath = path.join(datasetPath, `temp_${mapping.oldFolder}`);
    
    if (fs.existsSync(oldPath)) {
      fs.renameSync(oldPath, tempPath);
      console.log(`  ✓ ${mapping.oldFolder} → temp_${mapping.oldFolder}`);
    }
  });
  
  // Step 2: Rename to final names and update JSON
  console.log('\nStep 2: Renaming to final names and updating JSON...');
  mappings.forEach(mapping => {
    const tempPath = path.join(datasetPath, `temp_${mapping.oldFolder}`);
    const newPath = path.join(datasetPath, mapping.newFolder);
    
    if (fs.existsSync(tempPath)) {
      // Rename folder
      fs.renameSync(tempPath, newPath);
      console.log(`  ✓ temp_${mapping.oldFolder} → ${mapping.newFolder}`);
      
      // Update JSON file
      const jsonPath = path.join(newPath, 'field-data.json');
      if (fs.existsSync(jsonPath)) {
        const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        const fixedData = {};
        let fieldIdFixed = false;
        
        // Update date field for each field and fix field IDs
        Object.keys(data).forEach(fieldKey => {
          // Fix field ID: remove 'x' prefix and replace underscores with hyphens
          let fixedFieldKey = fieldKey;
          
          // Remove 'x' prefix if it exists at the start
          if (fixedFieldKey.startsWith('x')) {
            fixedFieldKey = fixedFieldKey.substring(1);
            fieldIdFixed = true;
          }
          
          // Replace underscores with hyphens
          if (fixedFieldKey.includes('_')) {
            fixedFieldKey = fixedFieldKey.replace(/_/g, '-');
            fieldIdFixed = true;
          }
          
          // Update the date field
          if (data[fieldKey].date) {
            data[fieldKey].date = mapping.newDate;
          }
          
          // Store with fixed key
          fixedData[fixedFieldKey] = data[fieldKey];
        });
        
        fs.writeFileSync(jsonPath, JSON.stringify(fixedData));
        console.log(`    → Updated dates in field-data.json`);
        if (fieldIdFixed) {
          console.log(`    → Fixed field IDs (removed 'x' prefix and replaced underscores)`);
        }
      }
    }
  });
  
  // Step 3: Update dates.json
  console.log('\nStep 3: Updating dates.json...');
  const datesJsonPath = path.join(datasetPath, 'dates.json');
  const newDates = mappings.map(m => m.newFolder);
  
  // Get customer ID from path or use default
  const pathParts = datasetPath.split(path.sep);
  const customerId = pathParts[pathParts.length - 1];
  
  const datesData = {
    dates: newDates,
    last_updated: new Date().toISOString(),
    customer_id: customerId,
    total_dates: newDates.length
  };
  
  fs.writeFileSync(datesJsonPath, JSON.stringify(datesData, null, 2));
  console.log('  ✓ Updated dates.json');
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Cloud data update complete!');
  console.log('='.repeat(60));
  console.log(`📅 Date Range: ${mappings[0].newDate} to ${mappings[mappings.length - 1].newDate}`);
  console.log(`📁 Total Folders: ${mappings.length}`);
  console.log('='.repeat(60) + '\n');
};

// Main execution
const main = async () => {
  try {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║     Cloud Data Date Update Tool - Standalone Mode         ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    
    // Get working directory
    const workingDirInput = await question('Enter the path to your data folder (or press Enter for current directory): ');
    const workingDir = workingDirInput.trim() || process.cwd();
    
    // Convert to absolute path
    const datasetPath = path.resolve(workingDir);
    
    if (!fs.existsSync(datasetPath)) {
      throw new Error(`Directory does not exist: ${datasetPath}`);
    }
    
    if (!fs.statSync(datasetPath).isDirectory()) {
      throw new Error(`Not a directory: ${datasetPath}`);
    }
    
    // List available date folders
    const dateFolders = getDateFolders(datasetPath);
    if (dateFolders.length === 0) {
      throw new Error('No date folders (8-digit format like 20250101) found in the directory');
    }
    
    console.log(`\nFound ${dateFolders.length} date folders:`);
    dateFolders.forEach(folder => console.log(`  • ${folder}`));
    console.log('');
    
    // Get end date
    const endDateInput = await question('Enter end date in DDMMYY format (e.g., 231025 for Oct 23, 2025): ');
    const endDate = parseDateFromDDMMYY(endDateInput.trim());
    
    // Confirm
    console.log('\n' + '-'.repeat(60));
    console.log('Configuration:');
    console.log(`  Working Directory: ${datasetPath}`);
    console.log(`  End Date: ${formatDateYYYYMMDDDash(endDate)}`);
    console.log(`  Date Folders Found: ${dateFolders.length}`);
    console.log('-'.repeat(60));
    
    const confirm = await question('\nProceed with update? (yes/no): ');
    
    if (confirm.toLowerCase() !== 'yes' && confirm.toLowerCase() !== 'y') {
      console.log('\n❌ Update cancelled by user.\n');
      rl.close();
      return;
    }
    
    // Perform update
    updateCloudData(datasetPath, endDate);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\nPlease check your inputs and try again.\n');
  } finally {
    rl.close();
  }
};

// Run the script
main();
