import os from "os";
import fs from "fs/promises";
import ReadLine from 'readline/promises';
import { jsonc } from "jsonc/lib/jsonc"

import assistant from './assistant-node';

import 'dotenv/config';

export type Node = {
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
      [key: string]: any;
    }>;
  };
  [key: string]: any;
};
export type ClaudeTool = {
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

export type ClaudeTextContent = {
  type: "text";
  text: string;
};

export type ClaudeToolUseContent = {
  type: "tool_use",
  id: string,
  name: string,
  input: Record<string, string>
};

export type ClaudeToolResultContent = {
  type: "tool_result",
  tool_use_id: string,
  content: string
};

export type ClaudeMessage = {
  role: "user" | "assistant",
  content: ClaudeResponse["content"]
};

export type ClaudeRequest = {
  "model": string,
  "max_tokens": number,
  "tools": ClaudeTool[],
  "messages": ClaudeMessage[]
};

export type ClaudeResponse = {
  "id": string,
  "type": "message",
  "role": "assistant",
  "model": string,
  "stop_sequence": null,
  "usage": { "input_tokens": number, "output_tokens": number },
  "content": string | ClaudeTextContent[] | ClaudeToolUseContent[] | ClaudeToolResultContent[];
  "stop_reason": "tool_use" | "stop_sequence" | "end_turn"
};


const testNodes = [
  {
    "onFail": null,
    "label": "Get weather",
    "script": "export default async ({\n    location,\n    unit\n}, {\n    logging\n}) => {\n    // API call to fetch weather based on location and unit\n    logging.log(`Weather info for ${location} in ${unit} unit`);\n    return `Weather info for ${location} in ${unit} unit`;\n}",
    "output": {
      "buildship": {},
      "description": "Weather information for the specified location and unit",
      "title": "Weather Info",
      "type": "string"
    },
    "type": "script",
    "id": "1ad17f18-3cb1-4422-859a-8db157bfc629",
    "inputs": {
      "required": ["location"],
      "properties": {
        "location": {
          "buildship": { "toBeAutoFilled": true, "index": 0 },
          "description": "The city and state, e.g. San Francisco, CA",
          "title": "Location",
          "type": "string"
        },
        "unit": {
          "description": "The unit of temperature, either \"celsius\" or \"fahrenheit\" use celcius by default",
          "title": "Unit",
          "buildship": {
            "index": 1,
            "sensitive": false,
            "options": [
              { "value": "celsius", "label": "Celsius" },
              { "label": "Fahrenheit", "value": "fahrenheit" }
            ],
            "toBeAutoFilled": true
          },
          "enum": ["celsius", "fahrenheit"],
          "pattern": "",
          "type": "string"
        }
      },
      "type": "object"
    },
    "meta": {
      "description": "Get the current weather in a given location with specified unit",
      "id": "1ad17f18-3cb1-4422-859a-8db157bfc629",
      "name": "Get weather"
    },
    "description": "Get the current weather in a given location"
  }
] as Node[];

const main = async () => {

  if (!process.env.CLAUDE_API_KEY) {
    throw new Error("Missing CLAUDE_API_KEY environment variable");
  }
  const logging = {
    log: (...message: any[]) => {
      console.log(jsonc.beautify(jsonc.stringify(message)));
      fs.writeFile("./log.txt", os.EOL + jsonc.stringify(message) + os.EOL, { flag: "a" });
    },
  }
  await assistant({
    claudeApiKey: process.env.CLAUDE_API_KEY,
    nodes: testNodes,
    model: "claude-3-opus-20240229",
    maxTokens: 1024,
    messages: undefined,
    systemPrompt: "Respond only in Turkish.",
    userPrompt: "What is the current weather in Bursa, Turkey?",
  }, {
    logging,
    execute: async (name: string, input: Record<string, any>) => {
      const node = testNodes.find(node => node.meta.name === name);
      if (node) {
        if (!input.location) {
          throw new Error("Missing location");
        }
        if (input.unit && !["celsius", "fahrenheit"].includes(input.unit)) {
          throw new Error("Invalid unit");
        }
        if (input.unit === "fahrenheit") {
          return "70°F";
        }
        return "21°C";
      }
      throw new Error(`Unknown tool: ${name}`);
    }
  }).then(console.log);

}
export const readLine = ReadLine.createInterface({ input: process.stdin, output: process.stdout });

main()
  .then(() => console.log("ok"))
  .catch(console.error);