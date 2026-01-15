import { Version3Client } from 'jira.js';
import { getCreds } from './config.js';

export const getJiraClient = () => {
  const creds = getCreds();

  if (!creds) {
    throw new Error('MISSING_CREDS');
  }

  // Ensure URL format is correct
  let host = creds.jiraUrl;
  if (host.endsWith('/')) host = host.slice(0, -1);

  return new Version3Client({
    host: host,
    authentication: {
      basic: {
        email: creds.email,
        apiToken: creds.apiToken,
      },
    },
  });
};
