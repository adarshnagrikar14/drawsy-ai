import React, { useEffect, useRef, useState } from "react";

type Props = {
  canvasTitle: string;
  projectTitle: string | null;
  focusProjectTitle: boolean;
  onCanvasTitleChange: (title: string) => void;
  onProjectTitleChange: (title: string) => void;
  onProjectTitleFocused: () => void;
  itemLabel?: string;
  readOnly?: boolean;
};

const EditableTitle = ({
  value,
  ariaLabel,
  autoFocus,
  onCommit,
  onFocused,
  readOnly,
}: {
  value: string;
  ariaLabel: string;
  autoFocus?: boolean;
  onCommit: (value: string) => void;
  onFocused?: () => void;
  readOnly?: boolean;
}) => {
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setDraft(value), [value]);
  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus();
      inputRef.current?.select();
      onFocused?.();
    }
  }, [autoFocus, onFocused]);

  const commit = () => {
    if (!readOnly) {
      onCommit(draft.trim() || value);
    }
  };

  return (
    <input
      ref={inputRef}
      className="workspace-title-input"
      aria-label={ariaLabel}
      readOnly={readOnly}
      value={draft}
      onChange={(event) => {
        if (!readOnly) {
          setDraft(event.target.value);
        }
      }}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          commit();
          event.currentTarget.blur();
        }
      }}
      size={Math.max(8, Math.min(24, draft.length || value.length))}
    />
  );
};

export const WorkspaceTitle = ({
  canvasTitle,
  projectTitle,
  focusProjectTitle,
  onCanvasTitleChange,
  onProjectTitleChange,
  onProjectTitleFocused,
  itemLabel = "Canvas",
  readOnly = false,
}: Props) => (
  <div className="workspace-title" data-testid="workspace-title">
    {projectTitle && (
      <>
        <EditableTitle
          value={projectTitle}
          ariaLabel="Project title"
          autoFocus={focusProjectTitle}
          onCommit={onProjectTitleChange}
          onFocused={onProjectTitleFocused}
          readOnly={readOnly}
        />
        <span className="workspace-title-separator">/</span>
      </>
    )}
    <EditableTitle
      value={canvasTitle}
      ariaLabel={`${itemLabel} title`}
      onCommit={onCanvasTitleChange}
      readOnly={readOnly}
    />
  </div>
);
