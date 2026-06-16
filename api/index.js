import express from 'express';
import dotenv from 'dotenv';
import { generateActivity } from '../lib/activityGenerator.js';

const app = express();
app.use(express.json());

dotenv.config();


app.all('/api/commit', async (req, res) => {
    try {
        const { GITHUB_TOKEN } = process.env;

        if (!GITHUB_TOKEN) {
            return res.status(500).json({ error: "GITHUB_TOKEN is not set" });
        }

        const owner = "monuar-mhx";
        const repo = "github-activity";

        // Bangladesh time (UTC+6)
        const now = new Date();
        const bdTime = new Date(now.getTime() + 6 * 60 * 60 * 1000);
        const year = bdTime.getUTCFullYear();
        const month = String(bdTime.getUTCMonth() + 1).padStart(2, '0');
        const day = String(bdTime.getUTCDate()).padStart(2, '0');
        const hours = String(bdTime.getUTCHours()).padStart(2, '0');
        const mins = String(bdTime.getUTCMinutes()).padStart(2, '0');
        const timestampStr = `${year}-${month}-${day} ${hours}:${mins}`;

        // Generate activity
        const activity = generateActivity(timestampStr);

        // Format commit message
        const commitMessage = `${activity.emoji} ${activity.type}: ${activity.message}`;

        const headers = {
            Authorization: `Bearer ${GITHUB_TOKEN}`,
            Accept: "application/vnd.github.v3+json",
            "Content-Type": "application/json",
            "User-Agent": "Vercel-Cron-App"
        };

        // Helper to get file
        const getFile = async (path) => {
            const resp = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
                headers
            });
            if (resp.status === 404) {
                return { sha: null, content: "" };
            }
            if (!resp.ok) {
                throw new Error(`Failed to get ${path}: ${resp.statusText}`);
            }
            const data = await resp.json();
            const content = Buffer.from(data.content, "base64").toString("utf-8");
            return { sha: data.sha, content };
        };

        // Find default branch
        const repoResp = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
        if (!repoResp.ok) throw new Error(`Failed to get repository info: ${repoResp.statusText}`);
        const repoData = await repoResp.json();
        const branch = repoData.default_branch || "main";

        // Get TS file
        const tsPath = "activity.ts";
        const tsData = await getFile(tsPath);
        let tsContent = tsData.content;
        const tsInterface = `export interface Activity {\nid: string\ntype: string\ncategory: string\nmessage: string\nemoji: string\nauthor: string\nsystem: string\nstatus: string\nenvironment: string\ntags: string[]\ntimestamp: string\n}\n\n`;

        if (!tsContent.includes("export interface Activity")) {
            tsContent = tsInterface + tsContent;
        }
        const tsAppend = `export const activity_${activity.id}: Activity = {\nid: "${activity.id}",\ntype: "${activity.type}",\ncategory: "${activity.category}",\nmessage: "${activity.message}",\nemoji: "${activity.emoji}",\nauthor: "${activity.author}",\nsystem: "${activity.system}",\nstatus: "${activity.status}",\nenvironment: "${activity.environment}",\ntags: ${JSON.stringify(activity.tags)},\ntimestamp: "${activity.timestamp}:00"\n};\n\n`;

        // Get JS file
        const jsPath = "activity.js";
        const jsData = await getFile(jsPath);
        let jsContent = jsData.content;
        const jsAppend = `export const activity_${activity.id} = {\nid: "${activity.id}",\ntype: "${activity.type}",\ncategory: "${activity.category}",\nmessage: "${activity.message}",\nemoji: "${activity.emoji}",\nauthor: "${activity.author}",\nsystem: "${activity.system}",\nstatus: "${activity.status}",\nenvironment: "${activity.environment}",\ntags: ${JSON.stringify(activity.tags)},\ntimestamp: "${activity.timestamp}:00"\n};\n\n`;

        // Create a single commit via Git Database API

        // 1. Get latest commit SHA
        const refResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`, { headers });
        if (!refResp.ok) throw new Error(`Failed to get branch reference: ${refResp.statusText}`);
        const refData = await refResp.json();
        const latestCommitSha = refData.object.sha;

        // 2. Get base tree SHA
        const commitResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/commits/${latestCommitSha}`, { headers });
        if (!commitResp.ok) throw new Error(`Failed to get latest commit: ${commitResp.statusText}`);
        const commitData = await commitResp.json();
        const baseTreeSha = commitData.tree.sha;

        // 3. Create new tree with both files
        const treeResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees`, {
            method: "POST",
            headers,
            body: JSON.stringify({
                base_tree: baseTreeSha,
                tree: [
                    { path: tsPath, mode: "100644", type: "blob", content: tsContent + tsAppend },
                    { path: jsPath, mode: "100644", type: "blob", content: jsContent + jsAppend }
                ]
            })
        });
        if (!treeResp.ok) throw new Error(`Failed to create tree: ${treeResp.statusText}`);
        const treeData = await treeResp.json();
        const newTreeSha = treeData.sha;

        // 4. Create new commit
        const newCommitResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/commits`, {
            method: "POST",
            headers,
            body: JSON.stringify({
                message: commitMessage,
                tree: newTreeSha,
                parents: [latestCommitSha]
            })
        });
        if (!newCommitResp.ok) throw new Error(`Failed to create commit: ${newCommitResp.statusText}`);
        const newCommitData = await newCommitResp.json();
        const newCommitSha = newCommitData.sha;

        // 5. Update branch reference
        const updateRefResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
            method: "PATCH",
            headers,
            body: JSON.stringify({ sha: newCommitSha })
        });
        if (!updateRefResp.ok) throw new Error(`Failed to update branch reference: ${updateRefResp.statusText}`);

        return res.status(200).json({ success: true, message: commitMessage, activity, sha: newCommitSha });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, error: err.message || String(err) });
    }
});

// Catch-all route for 404
app.use((req, res) => {
    res.status(404).json({ status: false, error: { code: 404, message: 'Not Found' } });
});

if (!process.env.VERCEL) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Express server running on port : ${PORT}`);
    });
}

export default app;
