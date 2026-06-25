"use client";

import Link from "next/link";
import { FormEvent, useMemo, useRef, useState } from "react";
import { Bot, Loader2, Send, Sparkles, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/cn";

type ProposedAction = {
  type: "mark_notifications_read" | "rsvp_event" | "remove_rsvp" | "save_opportunity";
  label: string;
  eventId?: string;
  opportunityId?: string;
  reason?: string;
};

type Message = {
  role: "user" | "assistant";
  content: string;
  suggestions?: Array<{ label: string; href: string }>;
  proposedActions?: ProposedAction[];
};

const starterPrompts = [
  "What should I check today?",
  "Recommend opportunities for me.",
  "What can I do as a club leader?",
  "Help me write a club announcement.",
];

export function AssistantChat({ configured }: { configured: boolean }) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hi — I’m StormHub Assistant. I can help you find clubs, understand what needs attention, draft club content, and point you to the right page.",
      suggestions: [
        { label: "Browse Clubs", href: "/clubs" },
        { label: "Open Calendar", href: "/calendar" },
        { label: "View Notifications", href: "/notifications" },
      ],
    },
  ]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const apiMessages = useMemo(
    () => messages
      .filter((message) => message.role === "user" || message.role === "assistant")
      .slice(-10)
      .map((message) => ({ role: message.role, content: message.content })),
    [messages]
  );

  async function submitPrompt(prompt?: string) {
    const content = (prompt ?? input).trim();
    if (!content || pending || !configured) return;
    setError(null);
    setInput("");
    const nextMessages: Message[] = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    setPending(true);

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            ...apiMessages,
            { role: "user", content },
          ],
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "Assistant failed.");
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: data.answer,
          suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
          proposedActions: Array.isArray(data.proposedActions) ? data.proposedActions : [],
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Assistant failed.");
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content:
            "I couldn’t answer that right now. If this keeps happening, check that the Groq API key is active and that the free-tier limit has not been reached.",
        },
      ]);
    } finally {
      setPending(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitPrompt();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <section className="rounded-2xl border bg-white shadow-sm">
        <div className="border-b p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-storm-electric/10 text-storm-electric">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-semibold text-storm-navy">StormHub Assistant</h2>
              <p className="text-xs text-muted-foreground">Read-only help for clubs, events, opportunities, and next steps.</p>
            </div>
          </div>
        </div>

        {!configured ? (
          <div className="p-6">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              StormHub Assistant is not configured yet. Add <code>GROQ_API_KEY</code> in Vercel and redeploy.
            </div>
          </div>
        ) : (
          <>
            <div className="max-h-[620px] space-y-4 overflow-y-auto p-4">
              {messages.map((message, index) => (
                <MessageBubble key={`${message.role}-${index}`} message={message} />
              ))}
              {pending && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Thinking...
                </div>
              )}
            </div>

            <div className="border-t p-4">
              {error && <p className="mb-2 text-sm text-red-700">{error}</p>}
              <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
                <Textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Ask about clubs, opportunities, notifications, permissions, or what to do next..."
                  rows={3}
                  maxLength={1200}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                      formRef.current?.requestSubmit();
                    }
                  }}
                />
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">Press Cmd/Ctrl + Enter to send.</p>
                  <Button type="submit" disabled={pending || !input.trim()}>
                    {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Send
                  </Button>
                </div>
              </form>
            </div>
          </>
        )}
      </section>

      <aside className="space-y-4">
        <div className="rounded-xl border bg-white p-4">
          <h3 className="font-semibold text-storm-navy">Try asking</h3>
          <div className="mt-3 space-y-2">
            {starterPrompts.map((prompt) => (
              <button
                key={prompt}
                onClick={() => void submitPrompt(prompt)}
                disabled={pending || !configured}
                className="block w-full rounded-lg border px-3 py-2 text-left text-sm text-storm-navy transition hover:border-storm-electric/40 hover:bg-storm-light/30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border bg-white p-4 text-sm text-muted-foreground">
          <h3 className="font-semibold text-storm-navy">Limits</h3>
          <p className="mt-2">
            The assistant can guide you and suggest links, but it cannot approve, delete, RSVP, send email, or change roles.
          </p>
        </div>
      </aside>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex gap-3", isUser && "justify-end")}>
      {!isUser && (
        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-storm-electric/10 text-storm-electric">
          <Bot className="h-4 w-4" />
        </div>
      )}
      <div className={cn("max-w-[85%] rounded-2xl px-4 py-3 text-sm", isUser ? "bg-storm-electric text-white" : "bg-storm-light/50 text-storm-navy")}>
        <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
        {!!message.proposedActions?.length && (
          <div className="mt-3 space-y-2">
            {message.proposedActions.map((action, index) => (
              <AssistantActionButton key={`${action.type}-${index}`} action={action} />
            ))}
          </div>
        )}
        {!!message.suggestions?.length && (
          <div className="mt-3 flex flex-wrap gap-2">
            {message.suggestions.map((suggestion) => (
              <Button key={`${suggestion.label}-${suggestion.href}`} variant="outline" size="sm" asChild className="bg-white">
                <Link href={suggestion.href}>{suggestion.label}</Link>
              </Button>
            ))}
          </div>
        )}
      </div>
      {isUser && (
        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-storm-navy text-white">
          <User className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}

function AssistantActionButton({ action }: { action: ProposedAction }) {
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function approve() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/assistant/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "Could not complete action.");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not complete action.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-xl border bg-white p-3 text-storm-navy">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Proposed action</p>
      <p className="mt-1 text-sm font-medium">{action.label}</p>
      {action.reason && <p className="mt-1 text-xs text-muted-foreground">{action.reason}</p>}
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
      <Button
        type="button"
        size="sm"
        className="mt-3"
        disabled={pending || done}
        onClick={approve}
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {done ? "Approved" : "Approve"}
      </Button>
    </div>
  );
}
