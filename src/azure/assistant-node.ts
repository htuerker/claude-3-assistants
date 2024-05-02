import { AssistantsClient, ToolDefinition } from "@azure/openai-assistants";
import { AzureKeyCredential } from "@azure/openai";
import { setTimeout } from "timers/promises";

const nodeToOpenAiFunction: (node: Node) => ToolDefinition = (node) => {
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

const sleep: (ms: number) => Promise<any> = (ms) =>
  new Promise((resolve) => setTimeout(ms).then(() => resolve(true)));

type Params = {
  azureApiKey: string;
  resource: string;
  assistantId: string;
  threadId: string;
  userPrompt: string;
  builtInTools: string[];
  instructions: any;
}

export default async function assistant(
  { azureApiKey, resource, assistantId, threadId, userPrompt, builtInTools = [], instructions }: Params,
  { logging, execute, nodes }: any
) {

  const tools = nodes?.map(nodeToOpenAiFunction) ?? [];

  const endpoint = `https://${resource}.openai.azure.com`;
  const credentials = new AzureKeyCredential(azureApiKey);
  const assistantsClient = new AssistantsClient(endpoint, credentials);

  const messages = [{ role: "user", content: userPrompt }];

  if (threadId) {
    await assistantsClient.createMessage(threadId, "user", userPrompt);
  } else {
    threadId = (await assistantsClient.createThread({ messages })).id;
    logging.log("New thread created with ID:", threadId);
  }

  // Retrieval tool isn't supported in Azure yet
  // builtInTools.includes("retrieval") && tools.push({ type: "retrieval" });
  builtInTools.includes("code_interpreter") && tools.push({ type: "code_interpreter" });

  let runResponse = await assistantsClient.createRun(threadId, {
    assistantId,
    instructions,
    tools,
  });

  do {
    await sleep(1000);
    runResponse = await assistantsClient.getRun(runResponse.threadId, runResponse.id);

    const isToolUse = runResponse.status === "requires_action" && runResponse.requiredAction?.type === "submit_tool_outputs";
    if (isToolUse) {
      const toolOutputs = [];
      const toolUses = runResponse.requiredAction?.submitToolOutputs?.toolCalls || [];
      for (const toolUse of toolUses) {
        let args;
        try {
          args = JSON.parse(toolUse.function.arguments);
          logging.log(args);
        } catch (err) {
          logging.log(`Couldn't parse function arguments. Received: ${toolUse.function.arguments}`);
          throw new Error(`Couldn't parse function arguments. Received: ${toolUse.function.arguments}`)
        }
        const node = nodes?.find((node: Node) => node.id === toolUse.function.name);
        if (!node) {
          throw new Error(`Unknown tool: ${toolUse.function.name}`);
        }
        const toolOutput = await execute(node.label, args);

        logging.log(toolOutput);
        toolOutputs.push({
          toolCallId: toolUse.id,
          output: toolOutput ? JSON.stringify(toolOutput) : ""
        });
        logging.log(
          `Executed ${node.label} with output:`,
          toolOutput
        );
      }
      runResponse = await assistantsClient.submitToolOutputsToRun(runResponse.threadId, runResponse.id, toolOutputs);
    }
  } while (runResponse.status === "queued" || runResponse.status === "in_progress")

  const { data } = await assistantsClient.listMessages(runResponse.threadId, { order: "desc" });

  const resultMessage = data[0];

  if (resultMessage.content[0].type === "text") {
    return {
      "response": resultMessage.content[0].text.value,
      "annotations": resultMessage.content[0].text.annotations,
      "threadId": runResponse.threadId,
      "messages": data
    };
  }

  if (resultMessage.content[0].type === "image_file") {
    return {
      "response": "",
      "imageFileId": resultMessage.content[0].imageFile.fileId,
      "annotations": [],
      "threadId": runResponse.threadId,
      "messages": data
    };
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