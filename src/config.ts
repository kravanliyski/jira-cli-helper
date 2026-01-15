import Conf from 'conf';

interface UserConfig {
  jiraUrl: string;
  email: string;
  apiToken: string;
  // New field: simple map of "short" -> "long"
  transitionAliases?: Record<string, string>;
  affectedFieldId?: string;
}

const config = new Conf<UserConfig>({
  projectName: 'jira-cli-helper',
});

export const getCreds = () => {
  const creds = {
    jiraUrl: config.get('jiraUrl'),
    email: config.get('email'),
    apiToken: config.get('apiToken'),
  };

  if (!creds.jiraUrl || !creds.email || !creds.apiToken) {
    return null;
  }
  return creds;
};

export const saveCreds = (creds: UserConfig) => {
  config.set('jiraUrl', creds.jiraUrl);
  config.set('email', creds.email);
  config.set('apiToken', creds.apiToken);
};

// --- New Alias Functions ---

export const saveAlias = (short: string, long: string) => {
  const current = config.get('transitionAliases') || {};
  current[short] = long;
  config.set('transitionAliases', current);
};

export const removeAlias = (short: string) => {
  const current = config.get('transitionAliases') || {};
  delete current[short];
  config.set('transitionAliases', current);
};

export const getAliases = () => {
  return config.get('transitionAliases') || {};
};

export const clearCreds = () => {
  config.clear();
};

export const setAffectedFieldId = (id: string) => {
  config.set('affectedFieldId', id);
};

export const getAffectedFieldId = () => {
  return config.get('affectedFieldId');
};
