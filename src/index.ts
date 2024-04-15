import os from "os";
import fs from "fs/promises";
import ReadLine from 'readline';
import { jsonc } from "jsonc/lib/jsonc"

import assistant from './assistant-node';

import 'dotenv/config';

const main = async () => {

  if (!process.env.CLAUDE_API_KEY) {
    throw new Error("Missing CLAUDE_API_KEY environment variable");
  }
  const logging = {
    log: (...message: any[]) => {
      console.log(jsonc.beautify(jsonc.stringify(message)));
      fs.writeFile("./log.txt", jsonc.stringify(message) + os.EOL, { flag: "a" });
    },
  }
  await assistant({
    claudeApiKey: process.env.CLAUDE_API_KEY,
    nodes: [{
      label: "get_weather",
      meta: {
        description: "Get the current weather in a given location",
      },
      inputs: {
        location: {
          type: "string",
          description: "The city and state, e.g. San Francisco, CA",
        },
        unit: {
          type: "string",
          description: 'The unit of temperature, either celsius or fahrenheit',
        },
      },
    }]
  }, {
    logging,
    execute: async (name: string, input: Record<string, any>) => {
      if (name === "get_weather") {
        if (!input.location) {
          throw new Error("Missing location");
        }
        if (input.unit && !["celsius", "fahrenheit"].includes(input.unit)) {
          throw new Error("Invalid unit");
        }
        console.log(`Getting weather for ${input.location} in ${input.unit ?? "celcius"}...`);
        if (input.unit === "fahrenheit") {
          return "70°F";
        }
        return "21°C";
      }
      throw new Error(`Unknown tool: ${name}`);
    }
  });

}
const readLine = ReadLine.createInterface({ input: process.stdin, output: process.stdout });

readLine.question("Press any key to continue", () => {
  main()
    .then(() => console.log("ok"))
    .catch(console.error)
});