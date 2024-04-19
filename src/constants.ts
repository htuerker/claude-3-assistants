import { Node } from "./types";

export const testNodes = [
  {
    "id": "892c8848-c961-45ab-927c-41c57c953bb7",
    "script": "export default async ({location, unit, notAutoFilled},{logging}) => {\n  console.log(\"notAutoFilled: \", notAutoFilled);\n  if(unit === \"fahrenheit\") {\n    return parseInt(Math.random() * 100) + \" F\";\n  }\n  return parseInt(Math.random() * 40) + \" C\";\n}",
    "dependencies": {},
    "name": "get_weather",
    "label": "get_weather",
    "description": "Get the current weather in a given location",
    "meta": {
      "id": "f5530a02-9a8e-44e8-9b85-88110e6f8aaa",
      "name": "get_weather",
      "description": "Get the current weather in a given location"
    },
    "type": "script",
    "inputs": {
      "properties": {
        "notAutoFilled": {
          "buildship": {
            "sensitive": false,
            "index": 2
          },
          "type": "string",
          "description": "",
          "default": "",
          "title": "notAutoFilled",
          "pattern": ""
        },
        "unit": {
          "type": "string",
          "title": "Unit",
          "default": "",
          "description": "The unit of temperature, either 'celsius' or 'fahrenheit', use 'celcius' if not specified",
          "buildship": {
            "toBeAutoFilled": true,
            "index": 1,
            "sensitive": false
          },
          "pattern": ""
        },
        "location": {
          "type": "string",
          "title": "Location",
          "description": "The city and state, e.g. San Francisco, CA",
          "pattern": "",
          "buildship": {
            "toBeAutoFilled": true,
            "sensitive": false,
            "index": 0
          }
        }
      },
      "required": ["location", "notAutoFilled"],
      "type": "object"
    },
    "output": {
      "title": "output",
      "type": "string",
      "buildship": {}
    },
    "onFail": null
  },
  {
    "meta": {
      "description": "Logs a message to the console",
      "icon": {
        "type": "SVG",
        "svg": "<path d=\"M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10s10-4.48 10-10S17.52 2 12 2zm0 15c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1s1 .45 1 1v4c0 .55-.45 1-1 1zm1-8h-2V7h2v2z\"></path>"
      },
      "name": "Log Message to Console",
      "id": "zzzzzzzzzzzzzzzzzzzy"
    },
    "dependencies": {},
    "script": "export default function logMessageToConsole({ message }, { logging }) {\n  logging.log(message);\n}\n",
    "id": "4b0be9e4-5ec8-4dbe-b57a-57334238daaa",
    "integrations": [],
    "type": "script",
    "output": {
      "type": "null",
      "buildship": {},
      "properties": {}
    },
    "label": "Log Message to Console",
    "inputs": {
      "type": "object",
      "required": ["message"],
      "properties": {
        "message": {
          "type": "string",
          "buildship": {
            "index": 0,
            "toBeAutoFilled": true
          },
          "title": "Message",
          "description": "The entire user prompt to log to the console"
        }
      }
    },
    "onFail": null,
    "_libRef": {
      "libType": "public",
      "integrity": "v3:f876505873e93e2d19ef822e9a7aa1a2",
      "libNodeRefId": "@buildship/zzzzzzzzzzzzzzzzzzzy",
      "version": "1.0.0",
      "src": "https://storage.googleapis.com/buildship-app-us-central1/cache/builtNodes/@buildship/zzzzzzzzzzzzzzzzzzzy/v1_0_0.cjs",
      "isDirty": true
    }
  },
  {
    "type": "script",
    "id": "d656c2a4-06c1-4986-a904-901388a1df2b",
    "dependencies": {},
    "meta": {
      "name": "get_time",
      "id": "d656c2a4-06c1-4986-a904-901388a1df2b",
      "description": "Get the current time in a given time zone"
    },
    "label": "get_time",
    "output": {
      "title": "output",
      "type": "string",
      "buildship": {}
    },
    "description": "Get the current time in a given time zone",
    "script": "export default async ({name},{logging}) => {\nlogging.log(`Hello `)\nreturn new Date().toLocaleString()\n      }",
    "inputs": {
      "type": "object",
      "required": ["foo"],
      "properties": {
        "foo": {
          "type": "string",
          "pattern": "",
          "buildship": {
            "sensitive": false,
            "index": 1
          },
          "default": "",
          "title": "bar",
          "description": ""
        },
        "name": {
          "description": "The IANA time zone name, e.g. America/Los_Angeles",
          "type": "string",
          "title": "timezone",
          "buildship": {
            "index": 0,
            "toBeAutoFilled": true,
            "sensitive": false
          }
        }
      }
    },
    "onFail": null
  }
] as Node[];