import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";

import { KanbanShareDialog } from "../components/KanbanShareDialog";

import type { KanbanApi } from "../data/KanbanApi";

vi.mock("@excalidraw/excalidraw/components/Dialog", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => (
    <div role="dialog">{children}</div>
  ),
}));

describe("KanbanShareDialog", () => {
  it("creates a scoped invite link without putting the token in a query", async () => {
    const createInvitation = vi.fn(() =>
      Promise.resolve({
        invitation: {
          id: "invitation-0001",
          boardId: "board-0001",
          email: "member@example.com",
          role: "editor" as const,
          status: "pending",
          expiresAt: Date.now() + 1000,
        },
        token: "secure-token",
      }),
    );
    const revokeInvitation = vi.fn(() => Promise.resolve());
    const api = {
      createInvitation,
      revokeInvitation,
    } as unknown as KanbanApi;

    render(
      <KanbanShareDialog
        mode="invite"
        api={api}
        boardId="board-0001"
        onClose={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText("name@company.com"), {
      target: { value: "member@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create invite link" }));

    await waitFor(() => expect(createInvitation).toHaveBeenCalledTimes(1));
    const link = screen.getByDisplayValue(
      /#kanban-invite=secure-token$/,
    ) as HTMLInputElement;
    expect(link.value).toContain("#kanban-invite=secure-token");
    expect(link.value).not.toContain("?kanban-invite");

    fireEvent.click(screen.getByRole("button", { name: "Revoke link" }));
    await waitFor(() =>
      expect(revokeInvitation).toHaveBeenCalledWith(
        "board-0001",
        "invitation-0001",
      ),
    );
    expect(screen.getByPlaceholderText("name@company.com")).not.toBeNull();
  });

  it("inspects before accepting and returns the accepted board", async () => {
    const inspectInvitation = vi.fn(() =>
      Promise.resolve({
        boardTitle: "Roadmap",
        role: "viewer" as const,
        expiresAt: Date.now() + 1000,
      }),
    );
    const acceptInvitation = vi.fn(() =>
      Promise.resolve({
        id: "board-0001",
        title: "Roadmap",
        role: "viewer" as const,
        revision: 1,
        status: "active" as const,
        updatedAt: 1,
      }),
    );
    const onAccepted = vi.fn(() => Promise.resolve());
    const api = {
      inspectInvitation,
      acceptInvitation,
    } as unknown as KanbanApi;

    render(
      <KanbanShareDialog
        mode="accept"
        api={api}
        token="secure-token"
        onAccepted={onAccepted}
        onClose={vi.fn()}
      />,
    );

    expect(await screen.findByText("Roadmap")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Accept invitation" }));

    await waitFor(() => expect(onAccepted).toHaveBeenCalledWith("board-0001"));
    expect(inspectInvitation).toHaveBeenCalledWith("secure-token");
    expect(acceptInvitation).toHaveBeenCalledWith("secure-token");
  });
});
