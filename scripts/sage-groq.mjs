import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const personalities = JSON.parse(
  readFileSync(join(root, "src/data/sage-personalities.json"), "utf8")
);

const personaName = process.argv[2] || "sage";
const question = process.argv.slice(3).join(" ") || "What does a critical hit do?";
const persona = personalities[personaName];

if (!persona) {
  console.error(`Unknown persona. Use one of: ${Object.keys(personalities).join(", ")}`);
  process.exit(1);
}

const body = {
  model: persona.model,
  temperature: persona.temperature,
  messages: [
    { role: "system", content: persona.system },
    { role: "user", content: question },
  ],
};

const key = process.env.GROQ_API_KEY;
if (!key) {
  console.log("No GROQ_API_KEY yet. This is the request that will be sent:");
  console.log(JSON.stringify(body, null, 2));
  process.exit(0);
}

const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(body),
});

const data = await response.json();
if (!response.ok) {
  console.error(data);
  process.exit(1);
}

console.log(data.choices?.[0]?.message?.content ?? data);
