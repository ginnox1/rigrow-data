# Rigrow User Onboarding Guide

This folder contains a script (`onboard.js`) designed to automate the creation of new user accounts by reading data from a CSV file.

## 1. CSV Creation & Modification

The script reads user and field data from a CSV file. **The first row must be the exact headers below:**

`userId,phoneNr,projectId,language,calendarType,datePickerType,fieldName,A,q,type,efficiency,lf,sf,nf`

### How to structure your data:
- **One row = One Field**: Each row represents a single field (e.g., "Tomato Block A"). 
- **Multiple Fields**: To give a user multiple fields, simply create multiple rows with the **same `userId`**. The script will automatically group them together into an array in that user's `user_config.json` file. You still need to repeat the user-level info (like `phoneNr`, `language`, etc.) on each row.
- **Drip vs Non-Drip fields**:
  - For **Drip** fields: Fill out the `type` (e.g., `Drip`) and `efficiency` columns. Leave `lf`, `sf`, and `nf` blank.
  - For **Non-Drip** fields: Leave `type` and `efficiency` blank. Fill out the `lf`, `sf`, and `nf` columns instead.

*Check `sample_users.csv` for examples of both types and a user with multiple fields.*

---

## 2. Dry Run (Safe Test Mode)

Always test your CSV file before writing any data. The `--dry-run` flag tells the script to parse the CSV and simulate the process without creating or modifying any actual files.

**Command:**
```bash
node onboarding/onboard.js path/to/your_file.csv --dry-run
```
*(If you run `node onboarding/onboard.js --dry-run` without specifying a path, it will test using `sample_users.csv`)*

**What to look for:**
The output will show you exactly how many unique users it found, list out the fields it grouped under each user, and tell you what file operations it *would* perform.

---

## 3. Actual Run

Once you verify the dry run output looks correct, run the script without the flag to write the files.

**Command:**
```bash
node onboarding/onboard.js path/to/your_file.csv
```

---

## 4. Expected Behavior and Results

When you execute an actual run, the script performs the following actions:

1. **Folder Creation**: It checks if a folder exists for the `userId` in `user-data/`. If it doesn't, it creates the folder.
2. **JSON Generation**: It generates the `user_config.json` file inside the user's folder.
3. **Overwriting Existing Users**: 
   - If a folder already exists and contains a `user_config.json` file for that `userId`, **the script will replace the existing file** with the newly generated one.
   - It will print a warning in the console: `✅ [userId]: OVERWRITTEN (Warning: file already existed)`.
4. **Registry Update**: It checks the `phoneNr` against `user_data/user_registry.json`. Any phone numbers that don't already exist in the registry will be mapped to their new `userId` and saved to the registry file.

### Example Final Output
After running the script, your `user-data` directory will look like this:
```text
user-data/
  ├─ user_registry.json    <-- phone numbers mapped to user IDs
  ├─ 1001/
  │   └─ user_config.json  <-- contains both "Block A Tomato" and "Block B Onion"
  ├─ 1002/
  │   └─ user_config.json
  └─ 1003/
      └─ user_config.json
```
