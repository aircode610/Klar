"use client";

import { useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowUp, Sparkles } from "lucide-react";
import type { ChatMessage } from "@/types/extra";
import { SEED_CHAT, QUICK_QUESTIONS, mockAnswer } from "@/lib/data/prototype";
import { cn } from "@/lib/utils";

let idc = 1000;

/**
 * "Ask a follow-up" — a focused Q&A grounded in this specific letter. A Klar
 * differentiator: no competitor offers per-letter conversation. Prototype: canned
 * but on-brand answers with a short typing delay.
 */
export function LetterChat({ letterId }: { letterId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>(
    SEED_CHAT[letterId] ?? [
      {
        id: "seed",
        role: "klar",
        text: "Ask me anything about this letter — your options, the deadline, or what happens next.",
      },
    ],
  );
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const quick = QUICK_QUESTIONS[letterId] ?? QUICK_QUESTIONS.default;
  const scrollRef = useRef<HTMLDivElement>(null);

  const send = (text: string) => {
    const q = text.trim();
    if (!q || typing) return;
    setMessages((m) => [...m, { id: `u${idc++}`, role: "user", text: q }]);
    setInput("");
    setTyping(true);
    setTimeout(() => {
      setMessages((m) => [...m, { id: `k${idc++}`, role: "klar", text: mockAnswer(q) }]);
      setTyping(false);
      requestAnimationFrame(() =>
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }),
      );
    }, 750);
  };

  return (
    <div className="rounded-[var(--radius-lg)] border border-line bg-surface">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <Sparkles size={16} strokeWidth={2} className="text-ink" aria-hidden />
        <span className="text-[0.9rem] font-semibold text-ink">Ask a follow-up</span>
        <span className="ms-auto font-mono text-[0.62rem] uppercase tracking-wide text-ink-2">
          about this letter
        </span>
      </div>

      <div ref={scrollRef} className="max-h-72 space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((m) => (
          <Bubble key={m.id} message={m} />
        ))}
        <AnimatePresence>
          {typing && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex gap-1 ps-1"
            >
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="size-1.5 rounded-full bg-ink-2"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* quick questions */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-2">
        {quick.map((q) => (
          <button
            key={q}
            onClick={() => send(q)}
            className="shrink-0 rounded-full border border-line bg-surface-2 px-3 py-1.5 text-[0.78rem] text-ink-2 transition-colors hover:text-ink"
          >
            {q}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-center gap-2 border-t border-line p-2.5"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your question…"
          className="h-10 flex-1 rounded-[var(--radius-md)] bg-surface-2 px-3 text-[0.9rem] text-ink outline-none placeholder:text-ink-2/70"
        />
        <button
          type="submit"
          aria-label="Send"
          disabled={!input.trim()}
          className={cn(
            "flex size-10 items-center justify-center rounded-[var(--radius-md)] transition-colors",
            input.trim() ? "bg-brand text-brand-ink" : "bg-surface-2 text-ink-2",
          )}
        >
          <ArrowUp size={18} strokeWidth={2.5} aria-hidden />
        </button>
      </form>
    </div>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className={cn("flex", isUser ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "max-w-[85%] rounded-[var(--radius-lg)] px-3.5 py-2.5 text-[0.875rem] leading-snug",
          isUser
            ? "rounded-se-sm bg-ink text-bg"
            : "rounded-ss-sm border border-line bg-surface-2 text-ink",
        )}
      >
        {message.text}
      </div>
    </motion.div>
  );
}
