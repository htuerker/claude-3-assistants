import Groq from 'groq-sdk';
import { snakeCase } from "lodash";
import { jsonc } from 'jsonc';

type Tool = Groq.Chat.CompletionCreateParams.Tool;
type FinishReason = "stop" | "length" | "tool_calls" | "content_filter";

const nodeToGroqTool: (node: Node) => Tool = (node) => {
  return {
    type: "function",
    function: {
      name: snakeCase(node.label || node.meta.name),
      description: node.meta.description ?? "",
      parameters: {
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
        }).filter(Boolean),
      }
    }
  };
}

type Params = {
  groqApiKey: string;
  model: string;
  maxTokens: number;
  userPrompt: string;
  systemPrompt: string;
};

export default async function assistant(
  { groqApiKey, model, maxTokens, userPrompt, systemPrompt }: Params,
  { logging, execute, nodes }: any
) {
  const groq = new Groq({ apiKey: groqApiKey });

  const tools: Tool[] = nodes?.map(nodeToGroqTool) ?? [];

  const initialMessages = [
    {
      "role": "system",
      "content": systemPrompt
    },
    {
      "role": "user",
      "content": userPrompt,
    }
  ] as Groq.Chat.CompletionCreateParams.Message[];

  const baseRequest = {
    "model": model,
    "max_tokens": maxTokens,
    "tools": tools,
    "messages": initialMessages
  }
  try {
    let requestCount = 1;
    let request = { ...baseRequest };
    let response: Groq.Chat.ChatCompletion;

    let finish_reasons: FinishReason[] = [];

    const isEndTurn = (reasons: FinishReason[]) =>
      reasons.includes("stop") ||
      reasons.includes("length") ||
      reasons.includes("content_filter");

    do {
      logging.log(`Groq request(${requestCount}):`, request);
      response = await groq.chat.completions.create(request);
      logging.log(`Groq response(${requestCount}): `, response);

      const choices = response.choices;
      finish_reasons = choices.map(choice => choice.finish_reason) as FinishReason[];

      if (isEndTurn(finish_reasons)) {
        break;
      }
      for (const choice of choices) {
        request.messages.push(choice.message);

        const finish_reason = choice.finish_reason as FinishReason;
        const isToolUse = finish_reason === "tool_calls";

        if (isToolUse) {
          const toolCalls = choice.message.tool_calls || [];

          for (const toolCall of toolCalls) {
            const node: Node = nodes?.find((node: Node) =>
              snakeCase(node.label || node.meta.name) === toolCall.function?.name);
            if (!node) {
              logging.log("Failed to find tool:");
              logging.log(toolCall);
              logging.log(node);
              throw new Error("Failed to find tool");
            }
            logging.log(`Tool: ${node.label} `);
            let args = {} as Record<string, unknown>;
            try {
              args = JSON.parse(toolCall.function?.arguments ?? "{}");
            } catch (cause) {
              logging.log("Failed to parse tool arguments");
              logging.log(toolCall.function?.arguments);
              logging.log(cause);
            }

            // filter hallucinated inputs
            const inputs = {} as Record<string, unknown>;
            for (const [inputKey, inputValue] of Object.entries(args)) {
              if (node.inputs.properties[inputKey]) {
                inputs[inputKey] = inputValue;
              }
            }
            const toolResponse = await execute(node.label, inputs);
            logging.log("Tool response: ", toolResponse);
            request.messages.push(
              {
                "tool_call_id": toolCall.id,
                "role": "tool",
                "name": toolCall.function?.name,
                "content": toolResponse ? JSON.stringify(toolResponse) : "",
              });
          }
        }
      }
      requestCount++;
    } while (!isEndTurn(finish_reasons));

    return {
      response: response.choices[0]?.message?.content || "No Response",
      threadId: null
    }
  } catch (error) {
    logging.log("Error:");
    logging.log(
      // remove circular references
      jsonc.parse(jsonc.stringify(error))
    );
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

