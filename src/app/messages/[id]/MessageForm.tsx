"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { sendMessage } from "../../../lib/actions";
import { Icon } from "../../../components/ui";

function SendButton({ label, disabled }: { label: string; disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      aria-label={label}
      disabled={disabled || pending}
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-court text-white shadow-sm transition hover:bg-court-dark disabled:opacity-40"
    >
      {pending ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Icon name="arrow" size={20} strokeWidth={2.2} className="-rotate-90" />}
    </button>
  );
}

export function MessageForm({ threadId, placeholder, sendLabel, maxLength }: { threadId: string; placeholder: string; sendLabel: string; maxLength: number }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [text, setText] = useState("");

  async function handleSubmit(formData: FormData) {
    await sendMessage(formData);
    formRef.current?.reset();
    setText("");
  }

  return (
    <form ref={formRef} action={handleSubmit} className="flex items-end gap-2 border-t border-slate/10 bg-chalk p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4">
      <input type="hidden" name="matchRequestId" value={threadId} />
      <textarea
        name="body"
        rows={1}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            if (text.trim()) formRef.current?.requestSubmit();
          }
        }}
        placeholder={placeholder}
        maxLength={maxLength}
        required
        autoComplete="off"
        className="max-h-40 min-h-[48px] flex-1 resize-none rounded-3xl border border-slate/20 bg-mist px-5 py-3 text-[15px] leading-6 outline-none focus-visible:outline-none focus-visible:outline-0 transition placeholder:text-slate-light focus:border-court focus:bg-chalk focus:ring-2 focus:ring-court/20 [field-sizing:content]"
      />
      <SendButton label={sendLabel} disabled={!text.trim()} />
    </form>
  );
}
