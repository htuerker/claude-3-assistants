import axios from "axios";

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
      required: Object.entries(node.inputs.properties).map(([name, value]) => {
        if (value.buildship && value.buildship.toBeAutoFilled && node.inputs.required.includes(name)) return name;
        return false;
      }).filter(Boolean) as string[],
    },
  };
}

type Params = {
  claudeApiKey: string;
  model: string;
  maxTokens: number;
  userPrompt: string;
  systemPrompt?: string;
  chatHistory?: ClaudeMessage[];
};

export default async function assistant(
  { claudeApiKey, model, maxTokens, userPrompt, systemPrompt, chatHistory }: Params,
  { logging, execute, nodes }: any
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

  const tools: ClaudeTool[] = nodes?.map(nodeToClaudeTool) ?? [];

  const initialMessages = [
    ...(chatHistory ?? []),
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
    let requestCount = 1;
    logging.log(`Claude request(${requestCount}):`, baseRequest);
    let response = await client.post("/messages", request);
    logging.log(`Claude response(${requestCount}): `, response.data);

    do {
      if (response.data.type === "error") {
        throw response.data.error;
      }

      let result = response.data;

      const isEndTurn = result.stop_reason === "end_turn";
      if (isEndTurn) break;

      const content = result.content;
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
          const node = nodes?.find((node: Node) => node.id === toolUse.name) as Node | undefined;
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
      if (isToolUse) {
        const toolUseMessageContent = [] as ClaudeToolResultContent[];

        const toolUses = content.filter(content => content.type === "tool_use");
        for (const toolUse of toolUses) {
          const tool = tools.find(tool => tool.name === toolUse.name);
          const node = nodes?.find((node: Node) => node.id === toolUse.name);
          if (!tool || !node) {
            logging.log("Failed to find tool:");
            logging.log(toolUse);
            logging.log(node);
            throw new Error("Failed to find tool");
          }
          logging.log("Tool node: ", node.name);
          const toolResponse = await execute(node.label, toolUse.input);
          logging.log("Tool response: ", toolResponse);
          toolUseMessageContent.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: toolResponse ? JSON.stringify(toolResponse) : "",
          });
        }
        request.messages.push({
          role: "user",
          content: toolUseMessageContent
        });
      }
      requestCount++;
      logging.log(`Claude request(${requestCount}):`, request);
      response = await client.post("/messages", request);
      logging.log(`Claude response(${requestCount}): `, response.data);
    } while (response && response.data && response.data.stop_reason !== "end_turn");

    return {
      response: response.data.content[0].text,
      chatHistory: [...request.messages, { role: "assistant", content: response.data.content }],
      data: response.data,
      error: null,
    }
  } catch (error) {
    logging.log(`Error: ${error}`);
    return { error }
  }
}

type Node = {
  label: string;
  meta: {
    id: string;
    description: string;
    name: string;
    [key: string]: any;
  };
  inputs: {
    type: string;
    required: string[];
    properties: Record<string, {
      description: string;
      buildship?: {
        toBeAutoFilled?: boolean;
        [key: string]: any;
      }
      [key: string]: any;
    }>;
  };
  [key: string]: any;
};

type ClaudeTool = {
  name: string;
  description: string;
  input_schema: {
    type: string;
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
    }>;
    required: string[];
  };
};

type ClaudeTextContent = {
  type: "text";
  text: string;
};

type ClaudeToolUseContent = {
  type: "tool_use",
  id: string,
  name: string,
  input: Record<string, string>
};

type ClaudeToolResultContent = {
  type: "tool_result",
  tool_use_id: string,
  content: string
};

type ClaudeMessage = {
  role: "user" | "assistant",
  content: ClaudeResponse["content"]
};

type ClaudeRequest = {
  "model": string,
  "max_tokens": number,
  "tools": ClaudeTool[],
  "messages": ClaudeMessage[]
};

type ClaudeResponse = {
  "id": string,
  "type": "message",
  "role": "assistant",
  "model": string,
  "stop_sequence": null,
  "usage": { "input_tokens": number, "output_tokens": number },
  "content": string | ClaudeTextContent[] | ClaudeToolUseContent[] | ClaudeToolResultContent[];
  "stop_reason": "tool_use" | "stop_sequence" | "end_turn"
};
