import { google } from 'googleapis';
import { config } from '../config';
import { logger } from '../utils/logger';
import * as http from 'http';
import * as url from 'url';
import { exec } from 'child_process';

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

function createOAuth2Client(redirectUri?: string) {
    return new google.auth.OAuth2(
        config.google.clientId,
        config.google.clientSecret,
        redirectUri || config.google.redirectUri
    );
}

/**
 * Get an authenticated OAuth2 client.
 * If a refresh token exists in config, use it.
 * Otherwise, run the interactive auth flow.
 */
export async function getAuthenticatedClient() {
    const oauth2Client = createOAuth2Client();

    if (config.google.refreshToken) {
        oauth2Client.setCredentials({
            refresh_token: config.google.refreshToken,
        });
        logger.info('Using existing refresh token for Gmail auth');
        return oauth2Client;
    }

    logger.info('No refresh token found. Starting interactive OAuth2 flow...');
    const tokens = await runInteractiveAuth();

    oauth2Client.setCredentials(tokens);

    if (tokens.refresh_token) {
        console.log('\n' + '='.repeat(60));
        console.log('IMPORTANT: Add this to your .env file:');
        console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
        console.log('='.repeat(60) + '\n');
    }

    return oauth2Client;
}

/**
 * Runs a local HTTP server to handle the OAuth2 callback.
 * Opens the auth URL in the user's browser.
 */
function runInteractiveAuth(): Promise<any> {
    return new Promise((resolve, reject) => {
        // Create a client with localhost:3000 as redirect
        const localClient = createOAuth2Client('http://localhost:3000');

        const server = http.createServer(async (req, res) => {
            try {
                const queryParams = url.parse(req.url || '', true).query;
                const code = queryParams.code as string;

                if (!code) {
                    res.writeHead(400, { 'Content-Type': 'text/html' });
                    res.end('<h1>Error: No authorization code received</h1>');
                    return;
                }

                const { tokens } = await localClient.getToken(code);

                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(`
          <html>
            <body style="font-family: sans-serif; text-align: center; padding: 50px; background: #1a1a2e; color: #eee;">
              <h1 style="color: #0f0;">✅ Authentication Successful!</h1>
              <p>You can close this window and return to the terminal.</p>
            </body>
          </html>
        `);

                server.close();
                resolve(tokens);
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'text/html' });
                res.end('<h1>Authentication failed</h1>');
                server.close();
                reject(err);
            }
        });

        server.listen(3000, () => {
            const authUrl = localClient.generateAuthUrl({
                access_type: 'offline',
                scope: SCOPES,
                prompt: 'consent',
            });

            logger.info('Opening browser for Google OAuth2 consent...');
            console.log('\nIf browser does not open, visit this URL:\n');
            console.log(authUrl + '\n');

            // Open browser
            const start = process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open';
            exec(`${start} "${authUrl}"`);
        });

        server.on('error', reject);
    });
}
