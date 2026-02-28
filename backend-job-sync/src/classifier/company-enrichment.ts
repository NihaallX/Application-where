import { logger } from '../utils/logger';

export interface CompanyEnrichment {
    name: string;
    domain: string | null;
    logo_url: string | null;
}

/**
 * Uses the free Clearbit Autocomplete API to fetch official company names and logos.
 * This helps deduplicate variations like "Amazon Web Services" and "AWS".
 */
export async function enrichCompany(rawName: string): Promise<CompanyEnrichment> {
    try {
        if (!rawName || rawName.length < 2) {
            return { name: rawName, domain: null, logo_url: null };
        }

        const url = `https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(rawName)}`;
        const res = await fetch(url, {
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!res.ok) {
            return { name: rawName, domain: null, logo_url: null };
        }

        const suggestions = await res.json() as Array<{ name: string; domain: string; logo: string }>;

        if (suggestions && suggestions.length > 0) {
            // The first suggestion is usually the most accurate match
            const bestMatch = suggestions[0];

            logger.debug(`Enriched company: ${rawName} -> ${bestMatch.name}`);

            return {
                name: bestMatch.name, // Use the official standardized name
                domain: bestMatch.domain,
                logo_url: bestMatch.logo
            };
        }

        // If no matches found, return original name
        return { name: rawName, domain: null, logo_url: null };

    } catch (err: any) {
        logger.warn(`Failed to enrich company: ${rawName}`, { error: err.message });
        return { name: rawName, domain: null, logo_url: null };
    }
}
