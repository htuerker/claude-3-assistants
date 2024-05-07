import 'dotenv/config';

import groqAssistant from "./assistant-node";

import { testNodes } from "../constants";

const groqApiKey = process.env.GROQ_API_KEY;
const model = "mixtral-8x7b-32768";
const maxTokens = 1024;
const messageHistory = [] as unknown[];
const systemPrompt = "You are a function calling LLM weather assistant. You must use defined tools to gather information such as get weather information for a city, get time, or log prompts.";
const userPrompt = "What is the weather like right now in New York? And what's the time in there? Also, log my prompt.";

const nodes = testNodes;

const logging = console;

const execute = async (name: string, input: Record<string, any>) => {
  console.log("Executing tool:", name, "with input:", input);
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

export default async function testGroqAsisstant({ useProduction = false }: { useProduction?: boolean } = {}) {
  if (!groqApiKey) {
    throw new Error("Missing GROQ_API_KEY environment variable");
  }
  return groqAssistant({
    groqApiKey,
    model,
    maxTokens,
    systemPrompt,
    userPrompt,
  }, {
    logging,
    nodes,
    execute,
  });
}