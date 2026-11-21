// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useChat } from "@ai-sdk/react";
import { ChatPanel } from "@/components/panels";

vi.mock("ai", () => ({ DefaultChatTransport: class DefaultChatTransport {} }));
vi.mock("@ai-sdk/react", () => ({ useChat: vi.fn() }));

const mockedUseChat = vi.mocked(useChat);

describe("co-architect chat panel", () => {
  const sendMessage = vi.fn();
  const stop = vi.fn();
  const regenerate = vi.fn();

  beforeEach(() => {
    mockedUseChat.mockReturnValue({
      messages: [],
      sendMessage,
      status: "ready",
      stop,
      regenerate,
      error: undefined,
    } as never);
  });

  it("exposes a labeled composer and sends the suggested /stitch prompt", async () => {
    const user = userEvent.setup();
    render(<ChatPanel />);

    expect(screen.getByRole("textbox", { name: "Message the co-architect" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Add an order confirmation event/i }));

    expect(sendMessage).toHaveBeenCalledWith({ text: "/stitch Add an order confirmation event after an order is created." });
  });

  it("shows a recoverable error and retries only after a message was sent", async () => {
    const user = userEvent.setup();
    mockedUseChat.mockReturnValue({
      messages: [{ id: "user-1", role: "user", parts: [{ type: "text", text: "Previous request" }] }],
      sendMessage,
      status: "ready",
      stop,
      regenerate,
      error: new Error("The provider is rate limited."),
    } as never);
    render(<ChatPanel />);

    const retry = screen.getByRole("button", { name: /Retry last message/i });
    expect(screen.getByRole("alert")).toHaveTextContent("The provider is rate limited.");
    expect(retry).toBeDisabled();

    await user.type(screen.getByRole("textbox", { name: "Message the co-architect" }), "Explain the checkout flow");
    await user.click(screen.getByRole("button", { name: "Send message" }));
    await waitFor(() => expect(retry).toBeEnabled());
    await user.click(retry);

    expect(regenerate).toHaveBeenCalledOnce();
  });
});
