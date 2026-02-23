import dotenv from 'dotenv';
dotenv.config();

export const config = {
    database: {
        url: requireEnv('DATABASE_URL'),
    },
    groq: {
        apiKey: requireEnv('GROQ_API_KEY'),
        apiKeys: [
            requireEnv('GROQ_API_KEY'),
            process.env.GROQ_API_KEY_2 || '',
            process.env.GROQ_API_KEY_3 || '',
        ].filter(Boolean),
        model: 'llama-3.1-8b-instant',
    },
    google: {
        clientId: requireEnv('GOOGLE_CLIENT_ID'),
        clientSecret: requireEnv('GOOGLE_CLIENT_SECRET'),
        refreshToken: process.env.GOOGLE_REFRESH_TOKEN || '',
        redirectUri: 'http://localhost',
    },
    syncModeOnly: process.env.SYNC_MODE_ONLY === 'true',
    // Backfill will only process emails after this date
    backfillAfterDate: process.env.BACKFILL_AFTER_DATE || '2025/06/01',
};

function requireEnv(key: string): string {
    const value = process.env[key];
    if (!value) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
    return value;
}
