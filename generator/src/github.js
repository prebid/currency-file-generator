import * as octokit from "octokit";
import {GetSecretValueCommand, SecretsManagerClient} from "@aws-sdk/client-secrets-manager";
import {getCurrencyFile, getGitEmail, getGithubSecret, getGitName, getJsdelivrPath, getRepo} from "./env.js";
import {retry} from "./retry.js";

async function getGHCredentials(smSecretId = getGithubSecret()) {
    const client = new SecretsManagerClient({});
    const secret = await client.send(new GetSecretValueCommand({
        SecretId: smSecretId
    }));
    return JSON.parse(secret.SecretString);
}

export async function getOctokit(credentials = getGHCredentials(), {App, Octokit} = octokit) {
    const {token, appId, privateKey, installationId} = await credentials;
    if (token) {
        return new Octokit({auth: token})
    } else {
        if (!appId || !privateKey || !installationId) {
            throw new Error('Missing GH credentials: either "token" or all of "appId", "privateKey", "installationId" are required');
        }
        const app = new App({appId, privateKey});
        return await app.getInstallationOctokit(installationId);
    }
}


export async function githubControls(
    {
        octokit = getOctokit(),
        repo = getRepo(),
        email = getGitEmail(),
        name = getGitName(),
        message = 'commit by :robot:',
        path = getCurrencyFile(),
    } = {}
) {
    octokit = await octokit;
    const contentPath = `/repos/${repo}/contents/{path}`;
    const headers = {
        'X-GitHub-Api-Version': '2022-11-28'
    }

    async function commitUpdate(newContents) {
        let sha;
        try {
            const current = await octokit.request(`GET ${contentPath}`, {path, headers});
            sha = current.data.sha;
        } catch (e) {
            if (e.status !== 404) {
                throw e;
            }
        }
        return (await octokit.request(`PUT ${contentPath}`, {
            path,
            message,
            committer: {
                name,
                email
            },
            sha,
            content: btoa(newContents),
            headers,
        })).data.commit;
    }

    function compareVersions(left, right) {
        for (let i = 0; i < 3; i++) {
            const diff = left[i] - right[i];
            if (diff !== 0) return diff;
        }
        return 0;
    }

    const TAG_PAT = /^(\d+)\.(\d+)\.(\d+)$/

    async function getLatestVersion() {
        const versions = (await octokit.request(`GET /repos/${repo}/tags`)).data
            .map(datum => TAG_PAT.exec(datum.name))
            .filter(match => match)
            .map(match => match.slice(1, 4).map(Number))
        // the api returns tags in creation order, but the docs do not guarantee it
        // let's trust (but verify) that the newest version is first. the alternative
        // would be to fetch potentially thousands more tags
        const latest = versions[0];
        versions.forEach((version) => {
            if (compareVersions(version, latest) > 0) {
                throw new Error(`Unexpected newer version found in older tag: ${version.join('.')}`)
            }
        })
        return latest;
    }

    async function tagCommit(tag, commitSha) {
        return await octokit.request(`POST /repos/${repo}/git/refs`, {
            ref: `refs/tags/${tag}`,
            sha: commitSha,
            headers
        })
    }

    return {
        commitUpdate,
        getLatestVersion,
        tagCommit
    }
}

export async function githubUpdater(
    {
        repo = getRepo(),
        file = getCurrencyFile(),
        ctl = githubControls({repo, path: file}),
        purgePath = getJsdelivrPath(),
        fetch_ = fetch,
        logger = console
    } = {}
) {
    ctl = await ctl;
    const purgeUrl = `https://purge.jsdelivr.net/${purgePath}${file}`
    // retry purges to avoid running everything again, which would
    // create unnecessary commits
    const purge = retry(() => fetch_(purgeUrl), {logger})

    return async function updateGH(newContents) {
        logger.info(`Updating GH "${repo}/${file}"...`)
        const currentVersion = await ctl.getLatestVersion();
        const newVersion = currentVersion == null ?
            '1.0.0' :
            currentVersion.slice(0, 2).concat(currentVersion[2] + 1).join('.');
        logger.info(`Updating GH to version ${newVersion}...`)
        const commit = await ctl.commitUpdate(newContents);
        await ctl.tagCommit(newVersion, commit.sha);
        logger.info(`Purging jsdelivr cache: ${purgeUrl}`)
        await purge();
    }
}
