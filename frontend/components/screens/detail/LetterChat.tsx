"use client";

import { useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowUp, Scale, Sparkles } from "lucide-react";
import type { ChatMessage } from "@/types/extra";
import type { DocumentCategory } from "@/types";
import { QUICK_QUESTIONS } from "@/lib/data/prototype";
import * as api from "@/lib/api";
import { cn } from "@/lib/utils";

let idc = 1000;

/**
 * "Ask a follow-up" — grounded in the real RAG knowledge base. Each question
 * hits POST /rag/search (filtered by the letter's institution) and answers from
 * the retrieved § paragraphs, citing the section. A Klar differentiator.
 */
export function LetterChat({
  institution,
  category,
}: {
  institution: string;
  category: DocumentCategory;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "seed",
      role: "klar",
      text: "Ask me anything about this letter — I'll answer from the actual German legal texts.",
    },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const quick = QUICK_QUESTIONS[category] ?? QUICK_QUESTIONS.default;
  const scrollRef = useRef<HTMLDivElement>(null);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || typing) return;
    setMessages((m) => [...m, { id: `u${idc++}`, role: "user", text: q }]);
    setInput("");
    setTyping(true);
    try {
      const { hits } = await api.ragSearch({ query: q, institution, top_k: 2 });
      const top = hits[0];
      const answer = top
        ? `${top.metadata?.section ? `${top.metadata.section} — ` : ""}${top.text}`
        : "I couldn't find a specific legal paragraph for that. In general: act before the deadline and keep everything in writing.";
      setMessages((m) => [...m, { id: `k${idc++}`, role: "klar", text: answer }]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          id: `k${idc++}`,
          role: "klar",
          text: "I can't reach the knowledge base right now — but act before the deadline and keep it in writing.",
        },
      ]);
    } finally {
      setTyping(false);
      requestAnimationFrame(() =>
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }),
      );
    }
  };

  return (
    <div className="rounded-(--radius-lg) border border-line bg-surface">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <Sparkles size={16} strokeWidth={2} className="text-ink" aria-hidden />
        <span className="text-[0.9rem] font-semibold text-ink">Ask a follow-up</span>
        <span className="ms-auto flex items-center gap-1 font-mono text-[0.62rem] uppercase tracking-wide text-ink-2">
          <Scale size={11} aria-hidden /> RAG-grounded
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
          placeholder="Ask about this letter…"
          className="h-10 flex-1 rounded-(--radius-md) bg-surface-2 px-3 text-[0.9rem] text-ink outline-none placeholder:text-ink-2/70"
        />
        <button
          type="submit"
          aria-label="Send"
          disabled={!input.trim()}
          className={cn(
            "flex size-10 items-center justify-center rounded-(--radius-md) transition-colors",
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
          "max-w-[85%] rounded-(--radius-lg) px-3.5 py-2.5 text-[0.875rem] leading-snug",
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
