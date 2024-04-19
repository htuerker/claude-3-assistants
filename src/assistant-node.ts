import axios from "axios";
import { Node, ClaudeTool, ClaudeRequest, ClaudeResponse, ClaudeMessage, ClaudeToolResultContent } from "./index.js";

const nodeToClaudeTool: (node: Node) => ClaudeTool = (node) => {
  return {
    // Use node.id as the name of the tool. Spaces are not allowed.
    name: node.id,
    description: node.meta.description ?? "",
    input_schema: {
      type: "object",
      properties: Object.entries(node.inputs.properties)
        .reduce((properties, [name, value]) => {
          if (value.buildship && !value.buildship.toBeAutoFilled) return properties;
          return {
            ...properties, [name]: {
              type: value.type,
              enum: value.enum,
              description: value.description
            }
          }
        }, {}),
      required: node.inputs.required ?? [],
    },
  };
}

export default async function assistant(
  { claudeApiKey, model, maxTokens, userPrompt, systemPrompt, messageHistory }:
    { claudeApiKey: string, model: string, maxTokens: number, userPrompt: string, systemPrompt?: string, messageHistory?: ClaudeMessage[] },
  { logging, execute, nodes }: { logging: any, execute: any, nodes: Node[] }
) {
  const version = "2023-06-01";
  const beta = "tools-2024-04-04";

  const client = axios.create({
    baseURL: "https://api.anthropic.com/v1",
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'x-api-key': claudeApiKey,
      'anthropic-version': version,
      'anthropic-beta': beta
    }
  });

  const tools = nodes?.map(nodeToClaudeTool) ?? []

  const initialMessages = [
    ...(messageHistory ?? []),
    {
      "role": "user",
      "content": userPrompt,
    }];

  const baseRequest = {
    "model": model,
    "max_tokens": maxTokens,
    "system": systemPrompt || "",
    "tools": tools,
    "messages": initialMessages
  } as ClaudeRequest;

  try {
    let request = { ...baseRequest };
    let response = await client.post("/messages", request);
    do {
      if (response.status !== 200) {
        if (response.data.type === "error") {
          throw response.data.error;
        }
        throw response;
      }
      let result = response.data as ClaudeResponse;
      const content = result.content;
      request
      request.messages.push({ role: "assistant", content });

      const isToolUse = result.stop_reason === "tool_use" && content instanceof Array;
      if (isToolUse) {
        const toolUseMessage = {
          role: "user" as ClaudeMessage["role"],
          content: [] as ClaudeToolResultContent[]
        };
        const toolUses = content.filter(content => content.type === "tool_use");
        for (const toolUse of toolUses) {
          const tool = tools.find(tool => tool.name === toolUse.name);
          const node = nodes?.find(node => node.id === toolUse.name);
          if (!tool || !node) {
            throw new Error(`Unknown tool: ${toolUse}`);
          }
          toolUseMessage.content.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            // use empty string as default content
            content: await execute(node.label, toolUse.input) ?? ""
          });
        }
        request.messages.push(toolUseMessage);
      }
      response = await client.post("/messages", request);
    } while (response && response.data && response.data.stop_reason !== "end_turn");
    const messageHistory = [...request.messages, { role: "assistant", content: response.data.content }]
    return { data: { ...response.data, messageHistory } };
  } catch (error) {
    logging.log(`Error: ${error}`);
    return { error }
  }
}