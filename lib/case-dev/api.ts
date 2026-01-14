// Case.dev API client for Testimony Prep Demo
// Includes LLM and OCR APIs with demo limit integration

const CASE_API_BASE = 'https://api.case.dev';

// Get API key from environment
function getApiKey(): string {
  const apiKey = process.env.CASE_API_KEY;
  if (!apiKey) {
    throw new Error('CASE_API_KEY environment variable is not set');
  }
  return apiKey;
}

// ============================================================================
// LLM API - Question Generation and AI Examiner
// ============================================================================

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  model: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    cost?: number;
  };
}

export interface ChatCompletionOptions {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

/**
 * Non-streaming chat completion
 */
export async function chatCompletion(
  messages: ChatMessage[],
  options: ChatCompletionOptions = {}
): Promise<ChatCompletionResponse> {
  const response = await fetch(`${CASE_API_BASE}/llm/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getApiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: options.model || 'anthropic/claude-sonnet-4-20250514',
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? 4096,
      stream: false,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`LLM API error: ${error}`);
  }

  return response.json();
}

/**
 * Streaming chat completion
 */
export async function* streamChatCompletion(
  messages: ChatMessage[],
  options: ChatCompletionOptions = {}
): AsyncGenerator<{ content: string; done: boolean; usage?: ChatCompletionResponse['usage'] }> {
  const response = await fetch(`${CASE_API_BASE}/llm/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getApiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: options.model || 'anthropic/claude-sonnet-4-20250514',
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? 4096,
      stream: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`LLM API error: ${response.statusText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') {
        yield { content: '', done: true };
        return;
      }

      try {
        const parsed = JSON.parse(data);
        const content = parsed.choices?.[0]?.delta?.content || '';
        const usage = parsed.usage;
        yield { content, done: false, usage };
      } catch {
        // Skip invalid JSON
      }
    }
  }
}

// ============================================================================
// OCR API - Document Processing
// ============================================================================

export interface OCRResult {
  id: string;
  status: 'processing' | 'completed' | 'failed';
  text?: string;
  pages?: {
    page_number: number;
    text: string;
    confidence?: number;
  }[];
  page_count?: number;
  error?: string;
}

export interface OCROptions {
  language?: string;
  enable_tables?: boolean;
  enable_forms?: boolean;
}

/**
 * Process a document with OCR
 * Supports PDF, images, and common document formats
 */
export async function processDocumentOCR(
  file: File | Blob,
  filename: string,
  options: OCROptions = {}
): Promise<OCRResult> {
  const formData = new FormData();
  formData.append('file', file, filename);

  if (options.language) {
    formData.append('language', options.language);
  }
  if (options.enable_tables !== undefined) {
    formData.append('enable_tables', String(options.enable_tables));
  }
  if (options.enable_forms !== undefined) {
    formData.append('enable_forms', String(options.enable_forms));
  }

  const response = await fetch(`${CASE_API_BASE}/ocr/process`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getApiKey()}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OCR API error: ${error}`);
  }

  return response.json();
}

/**
 * Get OCR job status (for async processing)
 */
export async function getOCRStatus(jobId: string): Promise<OCRResult> {
  const response = await fetch(`${CASE_API_BASE}/ocr/status/${jobId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${getApiKey()}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get OCR status: ${response.statusText}`);
  }

  return response.json();
}

// ============================================================================
// Vault API - Document Storage (Disabled in demo, kept for reference)
// ============================================================================

// Note: Vault API is disabled in the demo version.
// Documents are stored in localStorage instead.
// These functions are kept for reference but will throw if called.

export async function createVault(_name: string, _description?: string): Promise<never> {
  throw new Error('Vault API is disabled in demo mode. Documents are stored locally.');
}

export async function getUploadUrl(_vaultId: string, _filename: string, _contentType: string): Promise<never> {
  throw new Error('Vault API is disabled in demo mode. Documents are stored locally.');
}

export async function searchVault(_vaultId: string, _query: string): Promise<never> {
  throw new Error('Vault API is disabled in demo mode. Use local search instead.');
}

// ============================================================================
// Voice API - Transcription (Disabled in demo)
// ============================================================================

export async function createTranscription(_audioUrl: string): Promise<never> {
  throw new Error('Voice transcription is disabled in demo mode.');
}

export async function getTranscriptionStatus(_transcriptionId: string): Promise<never> {
  throw new Error('Voice transcription is disabled in demo mode.');
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Estimate token count for text (rough approximation)
 * Uses ~4 characters per token as average
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Check if API key is configured
 */
export function isApiConfigured(): boolean {
  return !!process.env.CASE_API_KEY;
}
