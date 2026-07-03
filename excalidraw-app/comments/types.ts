export type CommentMessage = {
  id: string;
  body: string;
  createdAt: number;
  updatedAt: number;
};

export type CanvasComment = {
  id: string;
  canvasId: string;
  x: number;
  y: number;
  elementId: string | null;
  status: "open" | "resolved";
  version: number;
  createdAt: number;
  updatedAt: number;
  messages: CommentMessage[];
};

export type CommentAnchor = {
  x: number;
  y: number;
  elementId: string | null;
};
