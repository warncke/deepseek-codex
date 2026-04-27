import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { DeepSeekProvider } from "../src/DeepSeekProvider.js";
import { AppConfig } from "../src/AppConfig.js";
import { ReplSession } from "../src/ReplSession.js";
import type { IInferenceProvider, IReplCommand } from "../src/interfaces.js";

const mockReadFile = jest.fn<() => Promise<string>>();
const mockWriteFile = jest.fn<() => Promise<void>>();
const mockAccess = jest.fn<() => Promise<void>>();

jest.unstable_mockModule("node:fs/promises", () => ({
  readFile: mockReadFile,
  writeFile: mockWriteFile,
  access: mockAccess,
}));

const { PromptLoader } = await import("../src/PromptLoader.js");

describe("AppConfig", () => {
  it("should parse default values", () => {
    const config = new AppConfig(["node", "script.js"]);
    expect(config.promptsDir).toBe("./prompts");
    expect(config.provider).toBe("deepseek");
    expect(config.baseUrl).toBeUndefined();
    expect(config.model).toBeUndefined();
    expect(config.apiKey).toBeUndefined();
  });

  it("should parse --prompts-dir", () => {
    const config = new AppConfig(["node", "script.js", "--prompts-dir", "/custom/prompts"]);
    expect(config.promptsDir).toBe("/custom/prompts");
  });

  it("should parse --provider", () => {
    const config = new AppConfig(["node", "script.js", "--provider", "openai"]);
    expect(config.provider).toBe("openai");
  });

  it("should parse --base-url", () => {
    const config = new AppConfig(["node", "script.js", "--base-url", "https://custom.api.com"]);
    expect(config.baseUrl).toBe("https://custom.api.com");
  });

  it("should parse --model", () => {
    const config = new AppConfig(["node", "script.js", "--model", "gpt-4"]);
    expect(config.model).toBe("gpt-4");
  });

  it("should parse --api-key", () => {
    const config = new AppConfig(["node", "script.js", "--api-key", "sk-test"]);
    expect(config.apiKey).toBe("sk-test");
  });
});

describe("DeepSeekProvider", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, DEEPSEEK_API_KEY: "test-key" };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should throw if DEEPSEEK_API_KEY is not set", () => {
    delete process.env.DEEPSEEK_API_KEY;
    expect(() => new DeepSeekProvider()).toThrow(
      "DEEPSEEK_API_KEY environment variable is not set.",
    );
  });

  it("should create instance when API key is set", () => {
    const provider = new DeepSeekProvider();
    expect(provider.providerName).toBe("DeepSeek V4");
    expect(provider.apiKeyEnvVar).toBe("DEEPSEEK_API_KEY");
  });

  it("should successfully chat and return response", async () => {
    const mockResponse = {
      choices: [{ message: { content: "Hello from AI" } }],
    };

    global.fetch = jest.fn<typeof global.fetch>().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const provider = new DeepSeekProvider();
    const result = await provider.chat([{ role: "user", content: "Hi" }]);

    expect(result).toBe("Hello from AI");
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("should retry on 429 and succeed", async () => {
    const mockResponse = {
      choices: [{ message: { content: "Success after retry" } }],
    };

    const fetchMock = jest
      .fn<typeof global.fetch>()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => "Rate limited",
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

    global.fetch = fetchMock;

    const provider = new DeepSeekProvider();
    const result = await provider.chat([{ role: "user", content: "Hi" }]);

    expect(result).toBe("Success after retry");
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("should throw on 401", async () => {
    global.fetch = jest.fn<typeof global.fetch>().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    } as Response);

    const provider = new DeepSeekProvider();
    await expect(provider.chat([{ role: "user", content: "Hi" }])).rejects.toThrow(
      "Authentication failed",
    );
  });

  it("should throw after exhausting retries on 500", async () => {
    global.fetch = jest.fn<typeof global.fetch>().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "Server error",
    } as Response);

    const provider = new DeepSeekProvider();
    await expect(provider.chat([{ role: "user", content: "Hi" }])).rejects.toThrow("Server error");
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });
});

describe("PromptLoader", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should load a prompt file", async () => {
    mockReadFile.mockResolvedValue("prompt content");

    const loader = new PromptLoader("./prompts");
    const result = await loader.loadPrompt("system-design-agent");

    expect(result).toBe("prompt content");
    expect(mockReadFile).toHaveBeenCalledWith("prompts/system-design-agent.md", "utf-8");
  });

  it("should load technical spec and validate header", async () => {
    mockReadFile.mockResolvedValue("# TECHNICAL SPECIFICATION\n\nSome content");

    const loader = new PromptLoader("./prompts");
    const result = await loader.loadTechnicalSpec();

    expect(result).toBe("# TECHNICAL SPECIFICATION\n\nSome content");
  });

  it("should throw if technical spec has invalid header", async () => {
    mockReadFile.mockResolvedValue("Invalid content");

    const loader = new PromptLoader("./prompts");
    await expect(loader.loadTechnicalSpec()).rejects.toThrow("Invalid technical specification");
  });

  it("should save technical spec", async () => {
    mockWriteFile.mockResolvedValue(undefined);

    const loader = new PromptLoader("./prompts");
    await loader.saveTechnicalSpec("new content");

    expect(mockWriteFile).toHaveBeenCalledWith(
      "prompts/technical-specification.md",
      "new content",
      "utf-8",
    );
  });

  it("should validate prompts directory", async () => {
    mockAccess.mockResolvedValue(undefined);

    const loader = new PromptLoader("./prompts");
    const result = await loader.validate();

    expect(result.valid).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it("should report missing files", async () => {
    mockAccess.mockRejectedValue(new Error("ENOENT"));

    const loader = new PromptLoader("./prompts");
    const result = await loader.validate();

    expect(result.valid).toBe(false);
    expect(result.missing).toHaveLength(3);
    expect(result.missing).toContain("system-design-agent.md");
    expect(result.missing).toContain("npm-project-creation-prompt.md");
    expect(result.missing).toContain("technical-specification.md");
  });
});

describe("ReplSession", () => {
  let mockProvider: jest.Mocked<IInferenceProvider>;
  let mockLoader: jest.Mocked<PromptLoader>;
  let session: ReplSession;

  beforeEach(() => {
    mockProvider = {
      providerName: "MockProvider",
      apiKeyEnvVar: "MOCK_KEY",
      chat: jest.fn(),
    } as unknown as jest.Mocked<IInferenceProvider>;

    mockLoader = {
      loadPrompt: jest.fn(),
      loadTechnicalSpec: jest.fn(),
      saveTechnicalSpec: jest.fn(),
      validate: jest.fn(),
    } as unknown as jest.Mocked<PromptLoader>;

    session = new ReplSession(mockProvider, mockLoader);
  });

  it("should register built-in commands", () => {
    const expectedCommands = ["help", "load", "spec", "chat", "append-spec", "run", "exit"];
    for (const cmd of expectedCommands) {
      expect(session.commands.has(cmd)).toBe(true);
    }
  });

  it("should register custom commands", () => {
    const customCommand: IReplCommand = {
      description: "Custom command",
      execute: jest.fn(),
    };

    session.registerCommand("custom", customCommand);
    expect(session.commands.has("custom")).toBe(true);
    expect(session.commands.get("custom")?.description).toBe("Custom command");
  });

  it("should have 7 built-in commands", () => {
    expect(session.commands.size).toBe(7);
  });

  it("should have help command with description", () => {
    const helpCmd = session.commands.get("help");
    expect(helpCmd).toBeDefined();
    expect(helpCmd?.description).toBeTruthy();
  });

  it("should have exit command that stops the session", async () => {
    const exitCmd = session.commands.get("exit");
    expect(exitCmd).toBeDefined();

    session.running = true;
    await exitCmd!.execute([], session);
    expect(session.running).toBe(false);
  });

  it("should have load command", () => {
    const loadCmd = session.commands.get("load");
    expect(loadCmd).toBeDefined();
    expect(loadCmd?.description).toContain("Load a prompt file");
  });

  it("should have spec command", () => {
    const specCmd = session.commands.get("spec");
    expect(specCmd).toBeDefined();
    expect(specCmd?.description).toContain("technical specification");
  });

  it("should have chat command", () => {
    const chatCmd = session.commands.get("chat");
    expect(chatCmd).toBeDefined();
    expect(chatCmd?.description).toContain("Send a message");
  });

  it("should have append-spec command", () => {
    const appendCmd = session.commands.get("append-spec");
    expect(appendCmd).toBeDefined();
    expect(appendCmd?.description).toContain("Append");
  });

  it("should have run command", () => {
    const runCmd = session.commands.get("run");
    expect(runCmd).toBeDefined();
    expect(runCmd?.description).toContain("Load a prompt");
  });
});
