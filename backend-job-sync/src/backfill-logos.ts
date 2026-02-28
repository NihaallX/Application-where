import dotenv from 'dotenv';
dotenv.config();
import { Pool } from 'pg';
import { enrichCompany } from './classifier/company-enrichment';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: true },
});

async function run() {
    const c = await pool.connect();
    try {
        console.log('--- ENRICHING EXISTING COMPANIES ---');
        // Get unique companies that haven't been enriched yet
        const jobs = await c.query(`
            SELECT DISTINCT company 
            FROM jobs 
            WHERE company_logo_url IS NULL 
            AND company != 'Unknown Company'
            ORDER BY company
        `);

        console.log(`Found ${jobs.rowCount} distinct companies to enrich...`);
        let enrichedCount = 0;
        let notFoundCount = 0;

        for (const row of jobs.rows) {
            // Introduce a small 100ms delay so we don't accidentally get rate limited by Clearbit
            await new Promise(r => setTimeout(r, 100));

            const enriched = await enrichCompany(row.company);

            if (enriched.logo_url) {
                // Update every job with this original company name
                await c.query(`
                    UPDATE jobs 
                    SET company = $1, company_logo_url = $2 
                    WHERE company = $3
                `, [enriched.name, enriched.logo_url, row.company]);

                enrichedCount++;
                if (enrichedCount % 10 === 0) {
                    console.log(`Enriched ${enrichedCount} companies so far...`);
                }
            } else {
                notFoundCount++;
            }
        }

        console.log(`\nDone! Enriched ${enrichedCount} companies. Could not find logos for ${notFoundCount}.`);

    } catch (e) {
        console.error(e);
    } finally {
        c.release();
        await pool.end();
    }
}

run().catch(console.error);
