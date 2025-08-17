import fs from 'fs';
import path from 'path';

const csvToJSON = (csvText) => {
  const lines = csvText.trim().split('\n');
  const headers = lines[0].split(',');
  
  return lines.slice(1).map(line => {
    const values = line.split(',');
    const obj = {};
    headers.forEach((header, index) => {
      obj[header.trim()] = values[index] ? values[index].trim() : '';
    });
    return obj;
  });
};

const main = async () => {
  try {
    // Read the main locations CSV
    const locationsCSV = fs.readFileSync(
      path.join(process.cwd(), 'scripts/Copy of KeralaLocations - Sheet 1.csv'), 
      'utf8'
    );
    const locationsData = csvToJSON(locationsCSV);
    
    // Read the block codes CSV
    const blockCodesCSV = fs.readFileSync(
      path.join(process.cwd(), 'scripts/Untitled spreadsheet - Sheet1.csv'), 
      'utf8'
    );
    const blockCodesData = csvToJSON(blockCodesCSV);
    
    // Create a lookup for block codes
    const blockCodeLookup = {};
    blockCodesData.forEach(row => {
      const key = `${row['District Name']}_${row['Block Name']}`;
      blockCodeLookup[key] = {
        district_code: row['District code'],
        block_code: row['Block Code']
      };
    });
    
    // Group data by district + block
    const groupedData = {};
    locationsData.forEach(row => {
      const key = `${row.District}_${row.Block}`;
      if (!groupedData[key]) {
        groupedData[key] = {
          state: row.State,
          state_code: row['State Code'],
          district: row.District,
          block: row.Block,
          gps: [],
          bhq: null
        };
      }
      
      // Add GP
      groupedData[key].gps.push({
        place: row.GP_name,
        latitude: parseFloat(row.Latitude),
        longitude: parseFloat(row.Longitude),
        type: 'GP'
      });
      
      // Add BHQ (only if not already added)
      if (!groupedData[key].bhq) {
        groupedData[key].bhq = {
          place: row.BHQ,
          latitude: parseFloat(row['BHQ Latitude']),
          longitude: parseFloat(row['BHQ Longitude']),
          type: 'BHQ'
        };
      }
    });
    
    // Create location documents
    const locationDocuments = [];
    Object.keys(groupedData).forEach(key => {
      const data = groupedData[key];
      const lookupKey = `${data.district}_${data.block}`;
      const codes = blockCodeLookup[lookupKey] || { district_code: '', block_code: '' };
      
      const route = [];
      if (data.bhq) {
        route.push(data.bhq);
      }
      route.push(...data.gps);
      
      locationDocuments.push({
        state: data.state,
        state_code: data.state_code,
        district: data.district,
        district_code: codes.district_code,
        block: data.block,
        block_code: codes.block_code,
        block_address: '',
        route: route
      });
    });
    
    // Write to JSON file
    const outputPath = path.join(process.cwd(), 'scripts/kerala_locations.json');
    fs.writeFileSync(outputPath, JSON.stringify(locationDocuments, null, 2));
    
    console.log(`✅ Successfully created ${locationDocuments.length} location documents`);
    console.log(`📁 Output saved to: ${outputPath}`);
    console.log(`📊 Total GPs processed: ${locationsData.length}`);
    
  } catch (error) {
    console.error('❌ Error processing CSV files:', error);
  }
};

main();
