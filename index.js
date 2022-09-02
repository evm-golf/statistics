const { Octokit } = require('octokit');
const { writeFileSync, mkdirSync } = require('fs');

(async function () {
    global.CACHE = {}
    const octokit = new Octokit({ auth: process.env.GITHUB_AUTH_TOKEN });
    for (global.SINCE = global.NEXTSINCE = '2022-09-02T00:00:00Z'; ; global.SINCE = global.NEXTSINCE) {
        const ret = await octokit.rest.issues.listCommentsForRepo({
            owner: `evm-golf`,
            repo: `solutions`,
            since: global.SINCE,
            per_page: 100,
        })
        for (const payload of ret.data) {
            if (payload.created_at > global.NEXTSINCE) {
                global.NEXTSINCE = payload.created_at;
            }
            if (payload.user.login !== 'github-actions[bot]') {
                continue;
            }
            try {
                const [, raweval] = payload.body.match(/\`\`\`json\n(\S+)\n\`\`\`/);
                const evaluation = JSON.parse(raweval);
                global.CACHE[evaluation.id] = evaluation;
            } catch {
                continue;
            }
        }
        if (global.NEXTSINCE === global.SINCE) {
            break;
        }
    }

    const challenges = new Set(Object.values(global.CACHE).map(v => v.challenge));

    global.INDEX = {}
    for (const challenge of challenges) {
        global.GASBEST = [];
        global.BEST = Number.MAX_SAFE_INTEGER;
        for (const payload of Object.values(global.CACHE)) {
            if (payload.challenge !== challenge) {
                continue;
            }
            if (payload.gas >= global.BEST) {
                continue;
            }
            global.BEST = payload.gas;
            global.GASBEST.push(payload);
        }
        global.GASBEST.reverse();

        global.LENBEST = [];
        global.BEST = Number.MAX_SAFE_INTEGER;
        for (const payload of Object.values(global.CACHE)) {
            if (payload.challenge !== challenge) {
                continue;
            }
            if (payload.length >= global.BEST) {
                continue;
            }
            global.BEST = payload.length;
            global.LENBEST.push(payload);
        }
        global.LENBEST.reverse();

        global.BEST = {};
        for (const payload of Object.values(global.CACHE)) {
            if (payload.challenge !== challenge) {
                continue;
            }
            if (global.BEST[payload.user] === undefined) {
                global.BEST[payload.user] = payload;
            } else if (payload.gas < global.BEST[payload.user].gas) {
                global.BEST[payload.user] = payload;
            }
        }
        const GASRANK = Object.values(global.BEST).sort((x, y) => {
            if (x.gas !== y.gas) {
                return x.gas - y.gas;
            }
            return x.id - y.id;
        });

        global.BEST = {};
        for (const payload of Object.values(global.CACHE)) {
            if (payload.challenge !== challenge) {
                continue;
            }
            if (global.BEST[payload.user] === undefined) {
                global.BEST[payload.user] = payload;
            } else if (payload.length < global.BEST[payload.user].length) {
                global.BEST[payload.user] = payload;
            }
        }
        const LENRANK = Object.values(global.BEST).sort((x, y) => {
            if (x.length !== y.length) {
                return x.length - y.length;
            }
            return x.id - y.id;
        });

        const gasbest = JSON.stringify(global.GASBEST);
        const lenbest = JSON.stringify(global.LENBEST);
        const gasrank = JSON.stringify(GASRANK);
        const lenrank = JSON.stringify(LENRANK);

        mkdirSync(challenge);
        writeFileSync(`${challenge}/gasbest.json`, gasbest);
        writeFileSync(`${challenge}/lenbest.json`, lenbest);
        writeFileSync(`${challenge}/gasrank.json`, gasrank);
        writeFileSync(`${challenge}/lenrank.json`, lenrank);
        if (global.GASBEST.length > 0 && global.LENBEST.length > 0) {
            global.INDEX[challenge] = {
                gas: global.GASBEST[0],
                length: global.LENBEST[0],
            };
        }
    };
    const index = JSON.stringify(global.INDEX);
    writeFileSync(`index.json`, index);
})();
