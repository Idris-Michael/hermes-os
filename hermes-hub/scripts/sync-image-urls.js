import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const profilesDir = path.join(__dirname, '..', 'data', 'profiles');

if (!fs.existsSync(profilesDir)) {
  console.error(`Profiles directory not found: ${profilesDir}`);
  process.exit(1);
}

const files = fs.readdirSync(profilesDir).filter(f => f.endsWith('.json'));

console.log(`Found ${files.length} agent profiles.`);

files.forEach(file => {
  const filePath = path.join(profilesDir, file);
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const profile = JSON.parse(raw);
    const expectedUrl = `/assets/agents/${profile.id}.png`;
    
    if (profile.imageUrl !== expectedUrl) {
      console.log(`Updating ${file}: imageUrl -> ${expectedUrl}`);
      profile.imageUrl = expectedUrl;
      fs.writeFileSync(filePath, JSON.stringify(profile, null, 2), 'utf-8');
    } else {
      console.log(`Profile ${file} already has correct imageUrl.`);
    }
  } catch (e) {
    console.error(`Error processing ${file}:`, e);
  }
});

console.log('Synchronization complete!');
