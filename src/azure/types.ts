export type OpenAiFunction = {
  type: "function" | "retrieval" | "code_interpreter",
  function?: {
    name: string,
    description: string,
    parameters: any
  }
}