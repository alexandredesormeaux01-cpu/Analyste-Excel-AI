import alasql from 'alasql';

export interface ColumnProfile {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'mixed';
  uniqueCount: number;
  sampleValues: any[];
  min?: number;
  max?: number;
  nullCount: number;
}

export interface DataProfile {
  rowCount: number;
  columns: ColumnProfile[];
}

export interface SheetProfile {
  sheetName: string;
  tableName: string;
  profile: DataProfile;
}

export function generateDataProfile(data: any[]): DataProfile {
  if (!data || data.length === 0) {
    return { rowCount: 0, columns: [] };
  }

  const headers = Object.keys(data[0]);
  const rowCount = data.length;
  const columns: ColumnProfile[] = headers.map(header => {
    const values = data.map(row => row[header]);
    const nonNullValues = values.filter(v => v !== null && v !== undefined && v !== '');
    const nullCount = rowCount - nonNullValues.length;
    
    // Detect type based on non-null values
    let type: ColumnProfile['type'] = 'string';
    if (nonNullValues.length > 0) {
      const firstVal = nonNullValues[0];
      if (typeof firstVal === 'number') type = 'number';
      else if (typeof firstVal === 'boolean') type = 'boolean';
      else if (firstVal instanceof Date) type = 'date';
      // Simple check for numeric strings
      else if (typeof firstVal === 'string' && !isNaN(Number(firstVal))) {
         // Check if all are numbers
         const allNumbers = nonNullValues.every(v => !isNaN(Number(v)));
         if (allNumbers) type = 'number';
      }
    }

    const uniqueValues = new Set(nonNullValues);
    
    let min: number | undefined;
    let max: number | undefined;

    if (type === 'number') {
      const numValues = nonNullValues.map(v => Number(v));
      if (numValues.length > 0) {
        min = Math.min(...numValues);
        max = Math.max(...numValues);
      }
    }

    return {
      name: header,
      type,
      uniqueCount: uniqueValues.size,
      nullCount,
      sampleValues: Array.from(uniqueValues).slice(0, 5), // Top 5 unique samples
      min,
      max
    };
  });

  return {
    rowCount,
    columns
  };
}

export function generateMultiSheetProfile(sheets: {name: string, data: any[]}[]): SheetProfile[] {
  return sheets.map(sheet => {
    // Sanitize and prefix table name to ensure valid SQL identifier
    const cleanName = sheet.name.replace(/[^a-zA-Z0-9_]/g, '_');
    const tableName = `T_${cleanName}`;
    return {
      sheetName: sheet.name,
      tableName,
      profile: generateDataProfile(sheet.data)
    };
  });
}

export function formatProfileForPrompt(profiles: SheetProfile[]): string {
  let summary = `Dataset Overview (${profiles.length} sheets):\n`;
  
  profiles.forEach(sheet => {
    summary += `\nSHEET: "${sheet.sheetName}" (SQL Table: ${sheet.tableName})\n`;
    summary += `- Total Rows: ${sheet.profile.rowCount}\n- Columns:\n`;
    sheet.profile.columns.forEach(col => {
      summary += `  - ${col.name} (${col.type}): ${col.uniqueCount} unique values. `;
      if (col.type === 'number') {
        summary += `Range: [${col.min}, ${col.max}]. `;
      }
      summary += `Samples: ${JSON.stringify(col.sampleValues)}\n`;
    });
  });
  
  return summary;
}

export function executeQuery(query: string, sheets: {name: string, data: any[]}[]): any[] {
  try {
    // Reset alasql database to avoid conflicts
    alasql('CREATE DATABASE IF NOT EXISTS main');
    alasql('USE main');

    // Register tables
    sheets.forEach(sheet => {
      const cleanName = sheet.name.replace(/[^a-zA-Z0-9_]/g, '_');
      const tableName = `T_${cleanName}`;
      
      // Drop if exists to ensure fresh data
      alasql(`DROP TABLE IF EXISTS ${tableName}`);
      alasql(`CREATE TABLE ${tableName}`);
      alasql.tables[tableName].data = sheet.data;
    });

    // Execute query
    const result = alasql(query);
    return Array.isArray(result) ? result : [result];
  } catch (error) {
    throw new Error(`SQL Error: ${error}`);
  }
}
