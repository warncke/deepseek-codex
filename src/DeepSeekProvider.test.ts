import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { DeepSeekProvider } from './DeepSeekProvider.js';

describe('DeepSeekProvider', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, DEEPSEEK_API_KEY: 'test-key' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should throw if DEEPSEEK_API_KEY is not set', () => {
    delete process.env.DEEPSEEK_API_KEY;
    expect(() => new DeepSeekProvider()).toThrow(
      'DEEPSEEK_API_KEY environment variable is not set.',
    );
  });

  it('should create instance when API key is set', () => {
    const provider = new DeepSeekProvider();
    expect(provider.providerName).toBe('DeepSeek V4');
    expect(provider.apiKeyEnvVar).toBe('DEEPSEEK_API_KEY');
  });

  it('should successfully chat and return response', async () => {
    const mockResponse = {
      choices: [{ message: { content: 'Hello from AI' } }],
    };

    global.fetch = jest.fn<typeof global.fetch>().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const provider = new DeepSeekProvider();
    const result = await provider.chat([{ role: 'user', content: 'Hi' }]);

    expect(result).toBe('Hello from AI');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('should retry on 429 and succeed', async () => {
    const mockResponse = {
      choices: [{ message: { content: 'Success after retry' } }],
    };

    const fetchMock = jest
      .fn<typeof global.fetch>()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'Rate limited',
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

    global.fetch = fetchMock;

    const provider = new DeepSeekProvider();
    const result = await provider.chat([{ role: 'user', content: 'Hi' }]);

    expect(result).toBe('Success after retry');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('should throw on 401', async () => {
    global.fetch = jest.fn<typeof global.fetch>().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    } as Response);

    const provider = new DeepSeekProvider();
    await expect(provider.chat([{ role: 'user', content: 'Hi' }])).rejects.toThrow(
      'Authentication failed',
    );
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('should throw rate limited error after retries exhausted', async () => {
    global.fetch = jest.fn<typeof global.fetch>().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'Too many requests',
    } as Response);

    const provider = new DeepSeekProvider();
    await expect(provider.chat([{ role: 'user', content: 'Hi' }])).rejects.toThrow(
      'Rate limited (429): Too many requests. Please try again later.',
    );
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('should throw after exhausting retries on 500', async () => {
    global.fetch = jest.fn<typeof global.fetch>().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Server error',
    } as Response);

    const provider = new DeepSeekProvider();
    await expect(provider.chat([{ role: 'user', content: 'Hi' }])).rejects.toThrow('Server error');
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('should throw after exhausting retries on 503', async () => {
    global.fetch = jest.fn<typeof global.fetch>().mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => 'Service unavailable',
    } as Response);

    const provider = new DeepSeekProvider();
    await expect(provider.chat([{ role: 'user', content: 'Hi' }])).rejects.toThrow(
      'Service unavailable',
    );
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('should throw on non-retryable HTTP error', async () => {
    global.fetch = jest.fn<typeof global.fetch>().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => 'Forbidden',
    } as Response);

    const provider = new DeepSeekProvider();
    await expect(provider.chat([{ role: 'user', content: 'Hi' }])).rejects.toThrow(
      'HTTP error 403: Forbidden',
    );
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('should retry on network fetch failure', async () => {
    const mockResponse = {
      choices: [{ message: { content: 'Recovered' } }],
    };

    const fetchMock = jest
      .fn<typeof global.fetch>()
      .mockRejectedValueOnce(new Error('Network failure'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

    global.fetch = fetchMock;

    const provider = new DeepSeekProvider();
    const result = await provider.chat([{ role: 'user', content: 'Hi' }]);

    expect(result).toBe('Recovered');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('should throw after exhausting retries on persistent network failure', async () => {
    global.fetch = jest.fn<typeof global.fetch>().mockRejectedValue(new Error('Network failure'));

    const provider = new DeepSeekProvider();
    await expect(provider.chat([{ role: 'user', content: 'Hi' }])).rejects.toThrow(
      'Network failure',
    );
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('should pass chat options to the API request', async () => {
    const mockResponse = {
      choices: [{ message: { content: 'With options' } }],
    };

    let requestBody: string | undefined;
    global.fetch = jest.fn<typeof global.fetch>().mockImplementation(async (_url, opts) => {
      requestBody = opts?.body as string;
      return {
        ok: true,
        json: async () => mockResponse,
      } as Response;
    });

    const provider = new DeepSeekProvider();
    await provider.chat([{ role: 'user', content: 'Hi' }], {
      temperature: 0.7,
      maxTokens: 100,
      thinking: { type: 'enabled' },
      reasoningEffort: 'max',
    });

    const body = JSON.parse(requestBody!);
    expect(body.temperature).toBe(0.7);
    expect(body.max_tokens).toBe(100);
    expect(body.thinking).toEqual({ type: 'enabled' });
    expect(body.reasoning_effort).toBe('max');
  });

  it('should use custom model from options', async () => {
    const mockResponse = {
      choices: [{ message: { content: 'Custom model' } }],
    };

    let requestBody: string | undefined;
    global.fetch = jest.fn<typeof global.fetch>().mockImplementation(async (_url, opts) => {
      requestBody = opts?.body as string;
      return {
        ok: true,
        json: async () => mockResponse,
      } as Response;
    });

    const provider = new DeepSeekProvider();
    await provider.chat([{ role: 'user', content: 'Hi' }], { model: 'custom-model' });

    const body = JSON.parse(requestBody!);
    expect(body.model).toBe('custom-model');
  });

  it('should set base URL via setBaseUrl', () => {
    const provider = new DeepSeekProvider();
    provider.setBaseUrl('https://custom.api.com');
  });

  it('should set API key via setApiKey', () => {
    const provider = new DeepSeekProvider();
    provider.setApiKey('new-key');
  });

  it('should set default model via setDefaultModel', () => {
    const provider = new DeepSeekProvider();
    provider.setDefaultModel('new-model');
  });

  it('should wrap non-Error fetch rejection in Error', async () => {
    global.fetch = jest.fn<typeof global.fetch>().mockRejectedValue('string error');

    const provider = new DeepSeekProvider();
    await expect(provider.chat([{ role: 'user', content: 'Hi' }])).rejects.toThrow('string error');
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('should wrap null fetch rejection in Error', async () => {
    global.fetch = jest.fn<typeof global.fetch>().mockRejectedValue(null);

    const provider = new DeepSeekProvider();
    await expect(provider.chat([{ role: 'user', content: 'Hi' }])).rejects.toThrow('null');
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('should throw when API response is missing choices[0].message.content', async () => {
    global.fetch = jest.fn<typeof global.fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: {} }] }),
    } as Response);

    const provider = new DeepSeekProvider();
    await expect(provider.chat([{ role: 'user', content: 'Hi' }])).rejects.toThrow(
      'API response missing message content',
    );
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('should throw when API response has null content', async () => {
    global.fetch = jest.fn<typeof global.fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: null } }] }),
    } as Response);

    const provider = new DeepSeekProvider();
    await expect(provider.chat([{ role: 'user', content: 'Hi' }])).rejects.toThrow(
      'API response missing message content',
    );
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
