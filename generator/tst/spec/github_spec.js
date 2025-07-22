import {getOctokit, githubControls, githubUpdater} from "../../src/github.js";
import sinon from 'sinon';
import {expect} from 'chai';
import {expectError} from "../utils.js";

describe('github', () => {
    describe('getOctokit', () => {
        let octo;
        beforeEach(() => {
            octo = {
                App: sinon.stub().callsFake(params => ({
                    getInstallationOctokit: sinon.stub().callsFake(installId => Promise.resolve({installId, appParams: params}))
                })),
                Octokit: sinon.stub().callsFake(({auth}) => ({usesToken: auth}))
            }
        });

        function getOcto(credentials) {
            return getOctokit(Promise.resolve(credentials), octo)
        }

        it('should use auth if secret has token', async () => {
            expect(await getOcto({token: 'ghToken'})).to.eql({usesToken: 'ghToken'});
        });
        it('should use app auth if secret has appId', async () => {
            expect(await getOcto({appId: 'app', privateKey: 'key', installationId: 'install'})).to.eql({
                installId: 'install',
                appParams: {
                    appId: 'app',
                    privateKey: 'key'
                }
            });
        });
        it('should throw if app credentials are incomplete', async () => {
            await expectError(() => getOcto({appid: 'app'}))
        });
    });

    describe('githubControls', () => {
        let octo, ctl, responses
        beforeEach(async () => {
            responses = {}
            octo = {
                request: sinon.stub().callsFake(req => {
                    const response = responses[req];
                    return typeof response === 'function' ? response() : response
                })
            }
            ctl = await githubControls({octokit: Promise.resolve(octo), repo: 'mock/repo', path: 'file.json'});
        });
        describe('commitUpdate', () => {
            beforeEach(() => {
                responses['PUT /repos/mock/repo/contents/{path}'] = Promise.resolve({data: {commit: {commit: 'data'}}})
            })
            it('should retrieve sha of file to update', async () => {
                responses['GET /repos/mock/repo/contents/{path}'] = Promise.resolve({data: {sha: 'digest'}});
                expect(await ctl.commitUpdate({})).to.eql({commit: 'data'})
                sinon.assert.calledWith(octo.request, 'PUT /repos/mock/repo/contents/{path}', sinon.match({sha: 'digest'}))
            });
            it('should not choke if file does not exist', async () => {
                responses['GET /repos/mock/repo/contents/{path}'] = Promise.reject({status: 404});
                await ctl.commitUpdate({})
                sinon.assert.calledWith(octo.request, 'PUT /repos/mock/repo/contents/{path}', sinon.match({sha: undefined}))
            });
        });
        describe('getLatestVersion', () => {
            let tags;
            beforeEach(() => {
                tags = [];
                responses['GET /repos/mock/repo/tags'] = () => Promise.resolve({
                    data: tags.map(tag => ({name: tag}))
                });
            })
            it('should throw if versions are not in order', async () => {
                tags = ['1.0.1', '1.2.0'];
                await expectError(() => ctl.getLatestVersion())
            });
            it('should not throw if tags are in order', async () => {
                tags = ['2.0.0', '1.0.1'];
                expect(await ctl.getLatestVersion()).to.eql([2, 0, 0]);
            })
            it('should parse version', async () => {
                tags = ['1.1.2', '1.1.1'];
                expect(await ctl.getLatestVersion()).to.eql([1, 1, 2]);
            })
            it('should ignore non-version-tags', async () => {
                tags = ['some-tag', '1.2.3'];
                expect(await ctl.getLatestVersion()).to.eql([1, 2, 3]);
            });
            it('should return undef when no version tags are present', async () => {
                tags = ['some-tag'];
                expect(await ctl.getLatestVersion()).to.not.exist;
            });
        });
    });
    describe('githubUpdater', () => {
        let ctl, updater, latestVersion, mockFetch;
        beforeEach(async () => {
            mockFetch = sinon.stub().callsFake(() => Promise.resolve())
            ctl = {
                getLatestVersion: sinon.stub().callsFake(() => Promise.resolve(latestVersion)),
                commitUpdate: sinon.stub().callsFake(() => ({sha: 'commit-sha'})),
                tagCommit: sinon.stub()
            }
            updater = await githubUpdater({
                file: 'currency.json',
                ctl,
                fetch_: mockFetch,
                purgePath: 'purge/',
            });
        });

        Object.entries({
            'no previous version exists': {
                expectVersion: '1.0.0'
            },
            'previous version is 1.0.123': {
                currentVersion: [1, 0, 123],
                expectVersion: '1.0.124'
            }
        }).forEach(([t, {currentVersion, expectVersion}]) => {
            describe(`when ${t}`, () => {
                beforeEach(() => {
                    latestVersion = currentVersion;
                });
                it(`should commit and tag version ${expectVersion}`, async () => {
                    await updater('contents');
                    sinon.assert.calledWith(ctl.commitUpdate, 'contents');
                    sinon.assert.calledWith(ctl.tagCommit, expectVersion, 'commit-sha');
                });
                it('should purge jsdelivr cache', async () => {
                    await updater('contents');
                    sinon.assert.calledWith(mockFetch, 'https://purge.jsdelivr.net/purge/currency.json');
                });
            })
        })
    })
})