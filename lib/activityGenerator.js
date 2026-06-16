import { getRandomMessage } from "./messageLibrary.js";

const activityTypes = [
    "feature",
    "update",
    "refactor",
    "automation",
    "optimization",
    "maintenance",
    "build",
    "docs"
];

const categories = [
    "automation",
    "performance",
    "system",
    "workflow",
    "repository",
    "maintenance",
    "analytics",
    "infrastructure"
];

const emojis = ["🚀", "⚡", "🔥", "✨", "🛠️", "📦", "💡", "🎯", "🧠", "🔧", "📊"];

const environments = ["production", "development", "staging"];

const tagPool = [
    ["performance", "optimization"],
    ["automation", "workflow"],
    ["maintenance", "repository"],
    ["refactor", "code-quality"],
    ["infrastructure", "reliability"],
    ["analytics", "telemetry"],
    ["build", "pipeline"]
];

const getRandomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function generateActivity(timestampStr) {
    return {
        id: Date.now().toString(),
        type: getRandomElement(activityTypes),
        category: getRandomElement(categories),
        message: getRandomMessage(),
        emoji: getRandomElement(emojis),
        author: "SudipMHX",
        system: "vercel-cron",
        status: "success",
        environment: getRandomElement(environments),
        tags: getRandomElement(tagPool),
        timestamp: timestampStr
    };
}
