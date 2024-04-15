import axios from "axios";

import fs from "fs";
import { jsonc } from "jsonc/lib/jsonc";

type Node = {
  label: string;
  meta: {
    description?: string;
  };
  inputs: Record<string, {
    type: string;
    description: string;
  }>;
}

type ClaudeTool = {
  name: string;
  description: string;
  input_schema: {
    type: string;
    properties: Record<string, {
      type: string;
      description: string;
    }>;
  };
}

const nodeToClaudeTool = (node: Node): ClaudeTool => {
  return {
    name: node.label,
    description: node.meta.description ?? "",
    input_schema: {
      type: "object",
      properties: node.inputs,
      // TODO: required fields
      // required: Object.keys(node.inputs),
    },
  };

}

type ClaudeResponse = {
  // "id": "msg_01MTjTLjDwbD5TRd8KAzmxFw",
  "id": string,
  // "type": "message",
  "type": "message",
  // "role": "assistant",
  "role": "assistant",
  // "model": "claude-3-opus-20240229",
  "model": string,
  "stop_sequence": null,
  // "usage": { "input_tokens": 527, "output_tokens": 129 },
  "usage": { "input_tokens": number, "output_tokens": number },
  // "content": [
  //   {
  //     "type": "text",
  //     "text": "<thinking>\nTo get the weather for a location, the relevant tool is get_weather. Let's look at the required parameters:\n\nlocation: The user provided \"San Francisco\", so we have the location.\n\nunit: This is not a required parameter, so we can proceed without it. The weather can be returned in the default units.\n</thinking>"
  //   },
  //   {
  //     "type": "tool_use",
  //     "id": "toolu_01McqgbVaxELGfAvVwFFpFdT",
  //     "name": "get_weather",
  //     "input": { "location": "San Francisco, CA" }
  //   }
  // ],
  "content": string | Array<{
    type: "text",
    "text": string
  } | {
    type: "tool_use",
    "id": string,
    name: "string",
    input: Record<string, string>
  } | {
    type: "tool_result",
    tool_use_id: string,
    content: string
  }>,
  "stop_reason": "tool_use" | "stop_sequence" | "end_turn"
}
export default async function assistant(
  { claudeApiKey, nodes }: { claudeApiKey: string, nodes?: Node[] },
  { logging, execute }: {
    logging: { log: (...message: any[]) => void },
    execute: (name: string, input: Record<string, any>) => Promise<any>
  }
) {

  const client = axios.create({
    baseURL: "https://api.anthropic.com/v1",
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'x-api-key': claudeApiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'tools-2024-04-04'
    }
  });

  const tools = nodes?.map(nodeToClaudeTool) ?? []
  logging.log(tools);


  const baseRequest = {
    "model": "claude-3-opus-20240229",
    "max_tokens": 1024,
    "tools": tools,
    "messages": [{
      "role": "user",
      "content": "What is the weather like in Bursa, Turkey in fahrenheit?"
    }]
  } as {
    model: string,
    max_tokens: number,
    tools: ClaudeTool[],
    messages: {
      role: "user" | "assistant",
      content: ClaudeResponse["content"]
    }[]
  }

  let nextRequest = { ...baseRequest };
  let currentResponse = await client.post("/messages", nextRequest);
  if (currentResponse.status !== 200) {
    throw currentResponse;
  }

  let currentData = currentResponse.data as ClaudeResponse;

  logging.log("current data:", currentData);

  if (currentData.stop_reason === "tool_use") {
    nextRequest = {
      ...nextRequest,
      messages: [
        ...nextRequest.messages, {
          role: "assistant",
          content: currentData.content
        }]
    }
    if (typeof currentData.content === "object") {
      const toolsToExecute = currentData.content.filter(content => content.type === "tool_use")
      for (const tool of toolsToExecute) {
        const toolOutput = await execute(tool.name, tool.input);
        nextRequest = {
          ...nextRequest,
          messages: [
            ...nextRequest.messages, {
              role: "user",
              content: [{
                type: "tool_result",
                tool_use_id: tool.id,
                content: toolOutput
              }]
            }]
        }
        logging.log("next request: ", nextRequest);
        currentResponse = await client.post("/messages", nextRequest);
        if (currentResponse.status !== 200) {
          // throw currentResponse;
        }
        logging.log("current response: ", currentResponse);
        currentData = currentResponse.data as ClaudeResponse;
        logging.log("current data:", currentData);
      }
    }
  }
}