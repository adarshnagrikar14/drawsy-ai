import { copyTextToSystemClipboard } from "@excalidraw/excalidraw/clipboard";
import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import { FilledButton } from "@excalidraw/excalidraw/components/FilledButton";
import { TextField } from "@excalidraw/excalidraw/components/TextField";
import { copyIcon, usersIcon } from "@excalidraw/excalidraw/components/icons";
import { useEffect, useState } from "react";

import "./KanbanShareDialog.scss";

import type { KanbanApi } from "../data/KanbanApi";

type Props =
  | {
      mode: "invite";
      api: KanbanApi;
      boardId: string;
      onClose: () => void;
    }
  | {
      mode: "accept";
      api: KanbanApi;
      token: string;
      onAccepted: (boardId: string) => Promise<void>;
      onClose: () => void;
    };

export const KanbanShareDialog = (props: Props) => {
  const invitationToken = props.mode === "accept" ? props.token : null;
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("editor");
  const [link, setLink] = useState("");
  const [invitationId, setInvitationId] = useState<string | null>(null);
  const [invitation, setInvitation] = useState<{
    boardTitle: string;
    role: "editor" | "viewer";
    expiresAt: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!invitationToken) {
      return;
    }
    let active = true;
    setBusy(true);
    void props.api
      .inspectInvitation(invitationToken)
      .then((value) => {
        if (active) {
          setInvitation(value);
          setError("");
        }
      })
      .catch(() => {
        if (active) {
          setError("This invitation is invalid, expired, or revoked.");
        }
      })
      .finally(() => {
        if (active) {
          setBusy(false);
        }
      });
    return () => {
      active = false;
    };
  }, [invitationToken, props.api]);

  const createInvitation = async () => {
    if (props.mode !== "invite" || !email.trim()) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await props.api.createInvitation(props.boardId, {
        email: email.trim(),
        role,
        expiresInHours: 168,
      });
      const url = new URL(window.location.href);
      url.hash = `kanban-invite=${encodeURIComponent(result.token)}`;
      setLink(url.toString());
      setInvitationId(result.invitation.id);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Couldn't create the invitation.",
      );
    } finally {
      setBusy(false);
    }
  };

  const acceptInvitation = async () => {
    if (props.mode !== "accept") {
      return;
    }
    setBusy(true);
    setError("");
    try {
      const board = await props.api.acceptInvitation(props.token);
      await props.onAccepted(board.id);
      props.onClose();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Couldn't accept the invitation.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog size="small" onCloseRequest={props.onClose} title={false}>
      <div className="kanban-share-dialog">
        <header>
          <span className="kanban-share-dialog__icon">{usersIcon}</span>
          <div>
            <h2>
              {props.mode === "invite" ? "Invite to Kanban" : "Join Kanban"}
            </h2>
            <p>
              {props.mode === "invite"
                ? "Create a single-use link restricted to the invited email."
                : "Review this invitation before joining the board."}
            </p>
          </div>
        </header>

        {props.mode === "invite" ? (
          link ? (
            <div className="kanban-share-dialog__result">
              <TextField
                value={link}
                readonly
                fullWidth
                label="Secure invite link"
              />
              <FilledButton
                size="large"
                label={copied ? "Copied" : "Copy link"}
                icon={copyIcon}
                onClick={async () => {
                  await copyTextToSystemClipboard(link);
                  setCopied(true);
                }}
              />
              <FilledButton
                size="medium"
                variant="outlined"
                color="danger"
                label="Revoke link"
                disabled={busy || !invitationId}
                onClick={async () => {
                  if (!invitationId) {
                    return;
                  }
                  setBusy(true);
                  try {
                    await props.api.revokeInvitation(
                      props.boardId,
                      invitationId,
                    );
                    setLink("");
                    setInvitationId(null);
                    setEmail("");
                  } catch (caught) {
                    setError(
                      caught instanceof Error
                        ? caught.message
                        : "Couldn't revoke the invitation.",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              />
              <p>
                The link expires in 7 days and only the verified invited email
                can accept it.
              </p>
            </div>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void createInvitation();
              }}
            >
              <TextField
                value={email}
                onChange={setEmail}
                fullWidth
                label="Email"
                placeholder="name@company.com"
              />
              <label className="kanban-share-dialog__role">
                <span>Access</span>
                <select
                  value={role}
                  onChange={(event) =>
                    setRole(event.target.value as "editor" | "viewer")
                  }
                >
                  <option value="editor">Can edit</option>
                  <option value="viewer">Can view</option>
                </select>
              </label>
              <FilledButton
                size="large"
                label={busy ? "Creating…" : "Create invite link"}
                onClick={() => void createInvitation()}
                disabled={busy || !email.trim()}
              />
            </form>
          )
        ) : (
          <div className="kanban-share-dialog__accept">
            {invitation && (
              <div className="kanban-share-dialog__summary">
                <strong>{invitation.boardTitle}</strong>
                <span>
                  {invitation.role === "editor" ? "Can edit" : "Can view"} ·
                  expires {new Date(invitation.expiresAt).toLocaleDateString()}
                </span>
              </div>
            )}
            <FilledButton
              size="large"
              label={busy ? "Joining…" : "Accept invitation"}
              onClick={() => void acceptInvitation()}
              disabled={busy || !invitation}
            />
          </div>
        )}

        {error && <div className="kanban-share-dialog__error">{error}</div>}
      </div>
    </Dialog>
  );
};
