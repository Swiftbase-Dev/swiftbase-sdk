import { makeRequest, HTTPMethod } from "./common/makerequest";

export interface AIToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface AITool {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, any>;
  };
}

export interface AIChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: AIToolCall[];
}

export interface AIChatCompletionOptions {
  model?: string;
  messages: AIChatMessage[];
  tools?: AITool[];
  tool_choice?: any;
  temperature?: number;
  max_tokens?: number;
}

export interface AIChatCompletionResponse {
  id?: string;
  object?: string;
  created?: number;
  model?: string;
  choices: Array<{
    index?: number;
    message: {
      role: string;
      content: string | null;
      tool_calls?: AIToolCall[];
    };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface AIPromptRunOptions {
  inputs?: Record<string, any>;
  parameters?: Record<string, any>;
  model?: string;
  temperature?: number;
  max_tokens?: number;
}

export interface AIPromptRunResponse {
  success?: boolean;
  output?: string;
  response?: string;
  model?: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * AI Service interface for completions and prompts.
 */
export const ai = {
  chat: {
    completions: {
      create: async (options: AIChatCompletionOptions): Promise<AIChatCompletionResponse> => {
        return await makeRequest(HTTPMethod.POST, "/api/ai/chat/completions", undefined, {
          model: options.model || "gemini-3.5-flash-lite",
          messages: options.messages,
          tools: options.tools,
          tool_choice: options.tool_choice,
          temperature: options.temperature,
          max_tokens: options.max_tokens,
        });
      }
    }
  },
  prompts: {
    run: async (promptId: string, options?: AIPromptRunOptions): Promise<AIPromptRunResponse> => {
      return await makeRequest(HTTPMethod.POST, `/api/ai/prompts/${promptId}/run`, undefined, {
        parameters: options?.parameters || options?.inputs || {},
        inputs: options?.inputs || options?.parameters || {},
        model: options?.model,
        temperature: options?.temperature,
        max_tokens: options?.max_tokens,
      });
    }
  }
};
