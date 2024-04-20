import 'dotenv/config';

import azureAssistantDev from "./assistant-node";
// @ts-ignore
import azureAssistantProd from "./assistant-node-clean";

import { testNodes } from "../constants";

const azureApiKey = process.env.AZURE_API_KEY;
const resource = "buildship-ai-test-us2";
const assistantId = "asst_gANqWtKZeXE2HpQYg5sbeOdC";
const threadId = "";
const userPrompt = "What is the weather like right now in New York? And what's the time in there? Also, log my prompt.";
const builtInTools = [] as string[];
const instructions = `
You can ask me about the weather and time in any city. I can also log your messages to the console.
- respond only in Turkish
- use get_weather tool to get the weather in a city
- use get_time tool to get the time in a city
- use log_message tool to log a message to the console
`;

const nodes = testNodes;

const logging = console;

const execute = async (name: string, input: Record<string, any>) => {
  if (name.includes("get_weather")) {
    if (input.unit === "fahrenheit") {
      return parseInt((Math.random() * 100).toString()) + " F";
    }
    return parseInt((Math.random() * 40).toString()) + " C";
  }
  if (name.includes("time")) {
    return new Date().toLocaleString();
  }
  if (name.includes("Log Message to Console")) {
    console.log(input.message);
    return "";
  }
  return `Unknown tool: ${name}`;
};

export default async function testClaudeAsisstant({ useProduction = false }: { useProduction?: boolean } = {}) {
  if (!azureApiKey) {
    throw new Error("Missing AZURE_API_KEY environment variable");
  }
  const assistant: typeof azureAssistantDev = useProduction ? azureAssistantProd : azureAssistantDev;
  return assistant({
    azureApiKey,
    resource,
    assistantId,
    threadId,
    userPrompt,
    builtInTools,
    instructions
  }, {
    logging,
    nodes,
    execute,
  });
}