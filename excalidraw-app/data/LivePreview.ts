export type DrawsyLivePreviewRequest = {
  previewId?: string;
  url: string;
  title?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
};

export type DrawsyLivePreview = {
  id: string;
  canvasId: string;
  url: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  collapsed: boolean;
};

export type DrawsyLivePreviewResizeHandle =
  | "n"
  | "ne"
  | "e"
  | "se"
  | "s"
  | "sw"
  | "w"
  | "nw";

export const resizeLivePreview = (
  preview: DrawsyLivePreview,
  handle: DrawsyLivePreviewResizeHandle,
  deltaX: number,
  deltaY: number,
  minimumWidth: number,
  minimumHeight: number,
): Pick<DrawsyLivePreview, "x" | "y" | "width" | "height"> => {
  const movesLeft = handle.includes("w");
  const movesRight = handle.includes("e");
  const movesTop = handle.includes("n");
  const movesBottom = handle.includes("s");
  const width = movesLeft
    ? Math.max(minimumWidth, preview.width - deltaX)
    : movesRight
    ? Math.max(minimumWidth, preview.width + deltaX)
    : preview.width;
  const height = movesTop
    ? Math.max(minimumHeight, preview.height - deltaY)
    : movesBottom
    ? Math.max(minimumHeight, preview.height + deltaY)
    : preview.height;

  return {
    x: movesLeft ? preview.x + preview.width - width : preview.x,
    y: movesTop ? preview.y + preview.height - height : preview.y,
    width,
    height,
  };
};

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export const normalizeLivePreviewUrl = (
  value: string,
  trustedRemoteOrigin?: string,
) => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("The live preview URL is invalid.");
  }

  const isLoopback =
    ["http:", "https:"].includes(url.protocol) &&
    LOOPBACK_HOSTS.has(url.hostname);
  let isTrustedRemote = false;
  if (trustedRemoteOrigin) {
    try {
      const trusted = new URL(trustedRemoteOrigin);
      isTrustedRemote =
        url.protocol === "https:" &&
        trusted.protocol === "https:" &&
        url.port === trusted.port &&
        (url.hostname === trusted.hostname ||
          url.hostname.endsWith(`.${trusted.hostname}`));
    } catch {
      isTrustedRemote = false;
    }
  }

  if ((!isLoopback && !isTrustedRemote) || url.username || url.password) {
    throw new Error(
      "Live previews must use a local loopback URL or the trusted Drawsy preview origin.",
    );
  }

  url.hash = "";
  return url.toString();
};

export const getLocalPreviewTitle = (urlValue: string) => {
  const url = new URL(urlValue);
  return url.port ? `${url.hostname}:${url.port}` : url.hostname;
};
