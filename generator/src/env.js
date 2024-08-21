import process from 'node:process';

function fromEnv(varName) {
    return function () {
        return process.env[varName];
    }
}

export const getCurrencyFile = fromEnv('CURRENCY_FILE');
export const getRepo = fromEnv('GITHUB_REPO');
export const getGitName = fromEnv('GITHUB_NAME');
export const getGitEmail = fromEnv('GITHUB_EMAIL');
export const getGithubSecret = fromEnv('GITHUB_SECRET');
export const getJsdelivrPath = fromEnv('JSDELIVR_PATH');
export const getCdnUrl = fromEnv('CDN_URL');
export const getBucket = fromEnv('BUCKET');
