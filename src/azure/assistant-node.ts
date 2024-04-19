import { AssistantsClient, ToolDefinition } from "@azure/openai-assistants";
import { AzureKeyCredential } from "@azure/openai";
import { setTimeout } from "timers/promises";

import { Node } from "../types";
import beautify from 'json-beautify';

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

export default async function assistant(
  { azureApiKey, resource, assistantId, threadId, userPrompt, builtInTools = [], instructions }:
    { azureApiKey: string, resource: string, assistantId: string, threadId: string, userPrompt: string, builtInTools: string[], instructions: any },
  { req, logging, execute, nodes }:
    { req: any, logging: any, execute: any, nodes: Node[] }
) {

  const tools = nodes?.map(nodeToOpenAiFunction) ?? [];

  console.log("***");
  console.log("Tools: ", beautify(tools, null as any, 2, 200));
  console.log("***");

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

  console.log("***");
  console.log("Create thread: ", beautify(threadId, null as any, 2, 200));
  console.log("***");

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

    console.log("***");
    console.log("Create run: ", beautify(runResponse, null as any, 2, 200));
    console.log("***");

    const isToolUse = runResponse.status === "requires_action" && runResponse.requiredAction?.type === "submit_tool_outputs";
    if (isToolUse) {
      const toolOutputs = [];
      const toolUses = runResponse.requiredAction?.submitToolOutputs?.toolCalls || [];
      for (const toolUse of toolUses) {
        let args;
        try {
          args = JSON.parse(toolUse.function.arguments);
        } catch (err) {
          logging.log(`Couldn't parse function arguments. Received: ${toolUse.function.arguments}`);
          throw new Error(`Couldn't parse function arguments. Received: ${toolUse.function.arguments}`)
        }
        const node = nodes?.find(node => node.id === toolUse.function.name);
        if (!node) {
          throw new Error(`Unknown tool: ${toolUse}`);
        }
        logging.log(`Executing ${node.meta.name} with args: ${args}`);
        const toolOutput = await execute(node.meta.name, args);

        logging.log(toolOutput);
        toolOutputs.push({
          toolCallId: toolUse.id,
          output: toolOutput ? JSON.stringify(toolOutput) : ""
        });
        logging.log(
          `Executed ${node.meta.name} with output:`,
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