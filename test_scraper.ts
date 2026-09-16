import { db } from './src/db';
import { leads } from './src/db/schema';
import { scrapeInstagramProfile } from './src/integrations/browser/instagramScraper';

async function testScraper() {
  const handle = 'aslsolucoestech'; // Using a known handle for testing
  console.log(`Scraping profile: ${handle}...`);
  
  try {
    const profile = await scrapeInstagramProfile(handle);
    console.log('Profile scraped:', profile);

    await db.insert(leads).values({
      instagramId: `test_id_${Date.now()}`,
      username: profile.username,
      fullName: profile.fullName,
      pipelineState: 'discovered',
      channelState: 'browser_contact_pending',
    });

    console.log('Lead inserted successfully!');
  } catch (error) {
    console.error('Error during test:', error);
  }
}

testScraper();
