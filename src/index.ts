import 'dotenv/config';
import beautify from "json-beautify";
import testClaudeAsisstant from "./claude/assistant-node.test";
import testAzureAssistant from './azure/assistant-node.test';

const main = async () => {
  // testClaudeAsisstant().then((result) => console.log(beautify(result, null as any, 2, 200))).catch(console.error);
  // testClaudeAsisstant({ useProduction: true }).then((result) => console.log(beautify(result, null as any, 2, 200))).catch(console.error);

  // testAzureAssistant().then((result) => console.log(beautify(result, null as any, 2, 200))).catch(console.error);
  testAzureAssistant({ useProduction: true }).then((result) => console.log(beautify(result, null as any, 2, 200))).catch(console.error);
}

main();