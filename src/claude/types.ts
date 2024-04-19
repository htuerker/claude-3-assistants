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

