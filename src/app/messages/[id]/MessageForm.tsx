"use client";

import { useRef } from "react";
import { sendMessage } from "../../../lib/actions";

export function MessageForm({
  threadId,
  placeholder,
  sendLabel,
  maxLength,
}: {
  threadId: string;
  placeholder: string;
  sendLabel: string;
  maxLength: number;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    await sendMessage(formData);
    formRef.current?.reset();
  }

  return (
    <form
      ref={formRef}
      action={handleSubmit}
      className="sticky bottom-0 flex gap-2 bg-chalk pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2"
    >
      <input type="hidden" name="matchRequestId" value={threadId} />
      <input
        className="input flex-1"
        name="body"
        placeholder={placeholder}
        maxLength={maxLength}
        required
        autoComplete="off"
      />
      <button className="btn-court">{sendLabel}</button>
    </form>
  );
}
