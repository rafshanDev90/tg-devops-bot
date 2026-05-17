we are going to add some new free model from open router:"import { OpenRouter } from "@openrouter/sdk";

const openrouter = new OpenRouter({
  apiKey: "<OPENROUTER_API_KEY>"
});

const stream = await openrouter.chat.send({
  model: "qwen/qwen3-next-80b-a3b-instruct:free",
  messages: [
    {
      "role": "user",
      "content": "What is the meaning of life?"
    }
  ],
  stream: true
});

for await (const chunk of stream) {
  const content = chunk.choices[0]?.delta?.content;
  if (content) {
    process.stdout.write(content);
  }
}" api key has been save ad OPEN_ROUTER in .env
import { OpenRouter } from "@openrouter/sdk";

const openrouter = new OpenRouter({
  apiKey: "<OPENROUTER_API_KEY>"
});

const stream = await openrouter.chat.send({
  model: "meta-llama/llama-3.3-70b-instruct:free",
  messages: [
    {
      "role": "user",
      "content": "What is the meaning of life?"
    }
  ],
  stream: true
});

for await (const chunk of stream) {
  const content = chunk.choices[0]?.delta?.content;
  if (content) {
    process.stdout.write(content);
  }
}
import { OpenRouter } from "@openrouter/sdk";

const openrouter = new OpenRouter({
  apiKey: "<OPENROUTER_API_KEY>"
});

const result = await openrouter.chat.send({
  model: "google/gemini-3-pro-image-preview",
  messages: [
    {
      role: "user",
      content: "Generate a beautiful sunset over mountains"
    }
  ],
  modalities: ["image", "text"]
});

const message = result.choices[0].message;
if (message.images) {
  message.images.forEach((image, index) => {
    const imageUrl = image.image_url.url;
    console.log(`Generated image ${index + 1}: ${imageUrl.substring(0, 50)}...`);
  });
}
import { OpenRouter } from "@openrouter/sdk";

const openrouter = new OpenRouter({
  apiKey: "<OPENROUTER_API_KEY>"
});

// Stream the response to get reasoning tokens in usage
const stream = await openrouter.chat.send({
  model: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
  messages: [
    {
      role: "user",
      content: "How many r's are in the word 'strawberry'?"
    }
  ],
  stream: true
});

let response = "";
for await (const chunk of stream) {
  const content = chunk.choices[0]?.delta?.content;
  if (content) {
    response += content;
    process.stdout.write(content);
  }

  // Usage information comes in the final chunk
  if (chunk.usage) {
    console.log("\nReasoning tokens:", chunk.usage.reasoningTokens);
  }
}