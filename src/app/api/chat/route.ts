import { createOpenAI } from "@ai-sdk/openai";
import { APICallError, convertToModelMessages, streamText, tool, validateUIMessages, type UIMessage } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { GraphDocumentSchema, serializeGraph, validateGraph, type GraphDocument } from "@/domain/graph";
import { applyGraphProposal, GraphProposalSchema } from "@/domain/proposal";

export const maxDuration = 30;

const RequestSchema = z.object({
  messages: z.array(z.unknown()).min(1).max(40),
  currentGraph: GraphDocumentSchema,
  stitchMode: z.boolean().optional(),
}).strict();

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "Chat is not configured. Add OPENAI_API_KEY to the server environment and restart the app." }, { status: 503 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (JSON.stringify(rawBody).length > 100_000) {
    return NextResponse.json({ error: "Chat request is too large. Shorten the conversation and try again." }, { status: 413 });
  }

  const parsed = RequestSchema.safeParse(rawBody);
  if (!parsed.success) return NextResponse.json({ error: "Chat request or graph document is invalid." }, { status: 400 });
  const graph: GraphDocument = parsed.data.currentGraph;
  if (validateGraph(graph).length) return NextResponse.json({ error: "The current graph must be valid before asking the co-architect." }, { status: 400 });

  const tools = {
    proposeGraph: tool({
      description: "Draft a small additive graph change. Ask a clarifying question first if the design depends on missing information.",
      inputSchema: GraphProposalSchema,
      outputSchema: GraphProposalSchema,
      execute: async (proposal) => {
        const draft = GraphProposalSchema.parse(proposal);
        const validation = applyGraphProposal(graph, draft);
        if (!validation.document) throw new Error(validation.errors.join(" "));
        return draft;
      },
    }),
  };
  let messages: UIMessage[];
  let modelMessages;
  try {
    messages = await validateUIMessages({ messages: parsed.data.messages, tools });
    modelMessages = await convertToModelMessages(messages, { tools, ignoreIncompleteToolCalls: true });
  } catch {
    return NextResponse.json({ error: "Conversation messages could not be validated." }, { status: 400 });
  }

  const provider = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const graphSource = serializeGraph(graph);
  const lastUser = messages.findLast((message) => message.role === "user");
  const requestText = lastUser?.parts.flatMap((part) => part.type === "text" ? [part.text] : []).join("") ?? "";
  const stitchMode = /^\s*\/stitch\b/i.test(requestText);
  const result = streamText({
    model: provider(process.env.OPENAI_MODEL || "gpt-4.1-mini"),
    system: `You are FlowStitch, a software architecture co-architect. Explain systems clearly and keep proposals small.

Current validated graph (native produkt DSL):
${graphSource}

For a request starting with /stitch, draft an additive graph proposal using proposeGraph. If the user is refining an unapplied draft, return the whole revised draft. The proposal is a draft; never claim it has been applied. Add new IDs only and connect them to nodes that exist above or in your proposal. Never overwrite or remove existing nodes or edges. If a needed detail is unclear, ask one focused question and ask the user to reply with /stitch plus the answer. Keep labels short. Only map declared fields with matching types. Never include executable transformations or backend behavior. For ordinary questions, explain the current graph.`,
    messages: modelMessages,
    tools,
    toolChoice: stitchMode ? "auto" : "none",
    abortSignal: request.signal,
    maxOutputTokens: 2500,
    onError: ({ error }) => console.error("FlowStitch chat stream failed", error instanceof Error ? error.name : "unknown error"),
  });

  return result.toUIMessageStreamResponse({
    headers: { "Cache-Control": "no-cache, no-transform" },
    onError: (error) => APICallError.isInstance(error) && error.statusCode === 429
      ? "The model provider is rate-limiting requests. Wait briefly, then retry."
      : "The model response could not be completed. Check the provider configuration or retry.",
  });
}
