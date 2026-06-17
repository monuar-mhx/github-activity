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
        const howMany = 5;

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

        const commits = [];
        let currentParentSha = null;

        // Get initial commit SHA
        const initialRefResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`, { headers });
        if (!initialRefResp.ok) throw new Error(`Failed to get branch reference: ${initialRefResp.statusText}`);
        const initialRefData = await initialRefResp.json();
        currentParentSha = initialRefData.object.sha;

        for (let i = 1; i <= howMany; i++) {
            // UTC-0 time
            const now = new Date();
            const year = now.getUTCFullYear();
            const month = String(now.getUTCMonth() + 1).padStart(2, '0');
            const day = String(now.getUTCDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;
            const hours = String(now.getUTCHours()).padStart(2, '0');
            const mins = String(now.getUTCMinutes()).padStart(2, '0');
            const timestampStr = `${year}-${month}-${day} ${hours}:${mins}`;

            // Generate activity
            const activity = generateActivity(timestampStr);

            // Generate 8-digit unique hex code
            const hexCode = Math.floor(Math.random() * 0xFFFFFFFF).toString(16).padStart(8, '0').toUpperCase();

            // Format commit message
            const commitMessage = `${activity.emoji} ${activity.type}: ${activity.message} #${hexCode}`;

            // Create file paths organized by date directory
            const tsPath = `activity/${dateStr}/activity_${hexCode}.ts`;
            const jsPath = `activity/${dateStr}/activity_${hexCode}.js`;

            // Create TypeScript file content
            const tsContent = `export interface Activity {\n  id: string;\n  type: string;\n  category: string;\n  message: string;\n  emoji: string;\n  author: string;\n  system: string;\n  status: string;\n  environment: string;\n  tags: string[];\n  timestamp: string;\n}\n\nexport const activity_${activity.id}: Activity = {\n  id: "${activity.id}",\n  type: "${activity.type}",\n  category: "${activity.category}",\n  message: "${activity.message}",\n  emoji: "${activity.emoji}",\n  author: "${activity.author}",\n  system: "${activity.system}",\n  status: "${activity.status}",\n  environment: "${activity.environment}",\n  tags: ${JSON.stringify(activity.tags)},\n  timestamp: "${activity.timestamp}:00"\n};\n`;

            // Create JavaScript file content
            const jsContent = `export const activity_${activity.id} = {\n  id: "${activity.id}",\n  type: "${activity.type}",\n  category: "${activity.category}",\n  message: "${activity.message}",\n  emoji: "${activity.emoji}",\n  author: "${activity.author}",\n  system: "${activity.system}",\n  status: "${activity.status}",\n  environment: "${activity.environment}",\n  tags: ${JSON.stringify(activity.tags)},\n  timestamp: "${activity.timestamp}:00"\n};\n`;

            // Get current commit
            const commitResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/commits/${currentParentSha}`, { headers });
            if (!commitResp.ok) throw new Error(`Failed to get commit: ${commitResp.statusText}`);
            const commitData = await commitResp.json();
            const baseTreeSha = commitData.tree.sha;

            // Create new tree with both files
            const treeResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees`, {
                method: "POST",
                headers,
                body: JSON.stringify({
                    base_tree: baseTreeSha,
                    tree: [
                        { path: tsPath, mode: "100644", type: "blob", content: tsContent },
                        { path: jsPath, mode: "100644", type: "blob", content: jsContent }
                    ]
                })
            });
            if (!treeResp.ok) throw new Error(`Failed to create tree: ${treeResp.statusText}`);
            const treeData = await treeResp.json();
            const newTreeSha = treeData.sha;

            // Create new commit
            const newCommitResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/commits`, {
                method: "POST",
                headers,
                body: JSON.stringify({
                    message: commitMessage,
                    tree: newTreeSha,
                    parents: [currentParentSha]
                })
            });
            if (!newCommitResp.ok) throw new Error(`Failed to create commit: ${newCommitResp.statusText}`);
            const newCommitData = await newCommitResp.json();
            const newCommitSha = newCommitData.sha;

            // Update current parent for next iteration
            currentParentSha = newCommitSha;
            commits.push({ message: commitMessage, sha: newCommitSha });

            // Minimal delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        // Final: Update branch reference to the last commit
        const updateRefResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
            method: "PATCH",
            headers,
            body: JSON.stringify({ sha: currentParentSha, force: true })
        });
        if (!updateRefResp.ok) {
            const errorData = await updateRefResp.json().catch(() => ({}));
            throw new Error(`Failed to update branch reference: ${updateRefResp.statusText} ${JSON.stringify(errorData)}`);
        }

        return res.status(200).json({ 
            success: true, 
            message: `Created 50 commits successfully`,
            commits: commits,
            finalSha: currentParentSha
        });
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
