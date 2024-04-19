import { AssistantsClient } from "@azure/openai-assistants";
import { AzureKeyCredential } from "@azure/openai";
import { setTimeout } from "timers/promises";
import { Node } from "../types";

function nodeToOpenAiFunction(
  node: Node
) {
  return {
    type: "function",
    function: {
      name: node.label,
      description: node.meta.description ?? "",
      parameters: sanitiseSchema(node.inputs),
    }
  };
}

function sanitiseSchema(schema: any) {
  const sanitizedSchema = { ...schema }
  for (const key of Object.keys(sanitizedSchema)) {
    if (sanitizedSchema[key].buildship && !sanitizedSchema[key].buildship.toBeAutoFilled) {
      sanitizedSchema[key].description = "this value is prefilled, you cant change it, so you should skip it"
    }
    delete sanitizedSchema[key].buildship
  }
  return sanitizedSchema;
}

export default async function assistant(
  { azureApiKey, resource, assistantId, threadId, prompt, builtInTools = [], instructions }:
    { azureApiKey: string, resource: string, assistantId: string, threadId: string, prompt: string, builtInTools: string[], instructions: any },
  { req, logging, execute, nodes }:
    { req: any, logging: any, execute: any, nodes: Node[] }
) {

  const tools = nodes?.map(nodeToOpenAiFunction) ?? [];

  console.log(tools);
  return;
  const endpoint = `https://${resource}.openai.azure.com`;

  const credentials = new AzureKeyCredential(azureApiKey);
  const assistantsClient = new AssistantsClient(endpoint, credentials);

  const messages = [{ role: "user", content: prompt }];

  if (threadId) {
    await assistantsClient.createMessage(threadId, "user", prompt);
  } else {
    threadId = (await assistantsClient.createThread({ messages })).id;
    logging.log("New thread created with ID:", threadId);
  }

  builtInTools.includes("retrieval") && tools.push({ type: "retrieval" });
  builtInTools.includes("code_interpreter") && tools.push({ type: "code_interpreter" });

  let runResponse = await assistantsClient.createRun(threadId, {
    assistantId,
    instructions,
    tools,
  });

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve(), 1000));
  do {
    await sleep(1000);
    runResponse = await assistantsClient.getRun(runResponse.threadId, runResponse.id);

    if (runResponse.status === "requires_action" && runResponse.requiredAction.type === "submit_tool_outputs") {
      const toolOutputs = [];
      for (const toolCall of runResponse.requiredAction.submitToolOutputs.toolCalls) {
        let args;
        try {
          args = JSON.parse(toolCall.function.arguments);
          logging.log(args)
        } catch (err) {
          logging.log(`Couldn't parse function arguments. Received: ${toolCall.function.arguments}`);
          throw new Error(`Couldn't parse function arguments. Received: ${toolCall.function.arguments}`)
        }
        const toolOutput = await execute(toolCall.function.name, args);

        logging.log(toolOutput);
        toolOutputs.push({
          toolCallId: toolCall.id,
          output: toolOutput ? JSON.stringify(toolOutput) : ""
        });
        logging.log(
          `Executed ${toolCall.function.name} with output:`,
          toolOutput
        );
      }
      runResponse = await assistantsClient.submitToolOutputsToRun(runResponse.threadId, runResponse.id, toolOutputs);
    }
  } while (runResponse.status === "queued" || runResponse.status === "in_progress")

  const { data } = await assistantsClient.listMessages(runResponse.threadId, { order: "desc" });

  return {
    "response": data[0].content[0].text.value,
    "annotations": data[0].content[0].text.annotations,
    "threadId": runResponse.threadId,
    "messages": data
  };
}