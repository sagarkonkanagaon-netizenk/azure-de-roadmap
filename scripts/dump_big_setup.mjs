// Prints the Playground's CREATE TABLE statements as JSON, for scripts/check_sql_blocks.py.
import { bigSetupSql } from '../src/data/bigdata.js'
process.stdout.write(JSON.stringify(bigSetupSql()))
