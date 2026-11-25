"use client";
import { useActionState } from "react";
import { decideProposal } from "@/app/proposal-actions";
export function ProposalDecision({
  id,
  status,
  legacy,
}: {
  id: string;
  status: string;
  legacy: boolean;
}) {
  const [state, action, pending] = useActionState(decideProposal, {});
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      {status === "review" && (
        <>
          {!legacy && (
            <button name="operation" value="accept" disabled={pending}>
              Accept proposal
            </button>
          )}
          <button name="operation" value="reject" disabled={pending}>
            Reject proposal
          </button>
          {legacy && (
            <p>
              This older snapshot is review-only. Generate a new proposal to
              apply changes.
            </p>
          )}
        </>
      )}
      {status === "accepted" && (
        <button name="operation" value="undo" disabled={pending}>
          Undo accepted proposal
        </button>
      )}
      <p role="alert">{state.error}</p>
      <p role="status">{state.success}</p>
    </form>
  );
}
