import os from "os";
import fs from "fs/promises";
import ReadLine from 'readline/promises';
import { jsonc } from "jsonc/lib/jsonc"

import 'dotenv/config';

import claudeAssistantDev from "./assistant-node";
// @ts-ignore
import claudeAssistantProd from "./assistant-node-clean";

import { testNodes } from "../constants";
import { ClaudeMessage } from "./types";

const claudeApiKey = process.env.CLAUDE_API_KEY;
const model = "claude-3-opus-20240229";
const maxTokens = 1024;
const messageHistory = [] as ClaudeMessage[];
const systemPrompt = "Respond only in Turkish.";
const userPrompt = "What is the weather like right now in New York? And what's the time in there? Also, log my prompt.";

const nodes = testNodes;

const logging = console.log;

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

export default async function testClaudeAsisstant({ useProduction = false }: { useProduction?: boolean } = {}) {
  if (!claudeApiKey) {
    throw new Error("Missing CLAUDE_API_KEY environment variable");
  }
  const assistant = useProduction ? claudeAssistantProd : claudeAssistantDev;
  return assistant({
    claudeApiKey,
    model,
    maxTokens,
    messageHistory,
    systemPrompt,
    userPrompt,
  }, {
    logging,
    nodes,
    execute,
  });
}