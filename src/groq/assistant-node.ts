import Groq from 'groq-sdk';

type Tool = Groq.Chat.CompletionCreateParams.Tool;

const nodeToGroqTool: (node: Node) => Tool = (node) => {
  return {
    type: "function",
    function: {
      name: node.id,
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
    let request = { ...baseRequest };
    let requestCount = 1;
    logging.log(`Groq request(${requestCount}):`, request);
    let response = await groq.chat.completions.create(request);

    logging.log(`Groq response(${requestCount}): `, response);

    do {
      // if (response.data.type === "error") {
      //   throw response.data.error;
      // }
      const choices = response.choices;
      const isEndTurn = choices.find(choice => choice.finish_reason === "stop");
      if (isEndTurn) {
        break;
      }
      for (const choice of choices) {
        logging.log("Choice: ", choice);
        request.messages.push(choice.message);
        const finish_reason = choice.finish_reason;

        const isToolUse = finish_reason === "tool_calls";
        if (!isToolUse) break;
        if (isToolUse) {
          const toolCalls = choice.message.tool_calls || [];
          logging.log("Tool calls: ", toolCalls);

          for (const toolCall of toolCalls) {
            const tool = tools.find(tool => tool.function?.name === toolCall.function?.name);
            const node = nodes?.find((node: Node) => node.id === toolCall.function?.name);
            if (!tool || !node) {
              logging.log("Failed to find tool:");
              logging.log(toolCall);
              logging.log(node);
              throw new Error("Failed to find tool");
            }
            logging.log("Tool node: ", node.label);
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
      logging.log(`Groq request(${requestCount}):`, request);
      response = await groq.chat.completions.create(request);
      logging.log(`Groq response(${requestCount}): `, response);
    } while (true);

    return {
      response: response.choices[0].message.content,
      // chatHistory: [...request.messages, { role: "assistant", content: response.data.content }],
      // data: response,
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

