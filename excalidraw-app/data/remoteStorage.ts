type UploadObjectParams = {
  objectKey: string;
  body: BodyInit;
  contentType: string;
  cacheControl?: string;
  contentDisposition?: string;
  metadata?: Record<string, string>;
  expiresInSeconds?: number;
};

const getStorageSignerUrl = () => {
  const signerUrl = import.meta.env.VITE_APP_STORAGE_SIGNER_URL?.trim();
  if (!signerUrl) {
    throw new Error("VITE_APP_STORAGE_SIGNER_URL is not configured");
  }
  return signerUrl.replace(/\/$/, "");
};

const normalizeObjectKey = (objectKey: string) => objectKey.replace(/^\//, "");

export const uploadObjectToStorage = async ({
  objectKey,
  body,
  contentType,
  cacheControl,
  contentDisposition,
  metadata,
  expiresInSeconds,
}: UploadObjectParams) => {
  const response = await fetch(`${getStorageSignerUrl()}/v1/uploads/presign`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      object_key: normalizeObjectKey(objectKey),
      content_type: contentType,
      cache_control: cacheControl,
      content_disposition: contentDisposition,
      metadata,
      expires_in_seconds: expiresInSeconds,
    }),
  });

  if (!response.ok) {
    throw new Error(`Storage upload presign failed: ${response.status}`);
  }

  const { url, headers } = await response.json();
  const uploadResponse = await fetch(url, {
    method: "PUT",
    headers,
    body,
  });

  if (!uploadResponse.ok) {
    throw new Error(`Storage upload failed: ${uploadResponse.status}`);
  }
};

export const downloadObjectFromStorage = async (
  objectKey: string,
  expiresInSeconds?: number,
) => {
  const response = await fetch(`${getStorageSignerUrl()}/v1/downloads/presign`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      object_key: normalizeObjectKey(objectKey),
      expires_in_seconds: expiresInSeconds,
    }),
  });

  if (!response.ok) {
    throw new Error(`Storage download presign failed: ${response.status}`);
  }

  const { url } = await response.json();
  const downloadResponse = await fetch(url);

  if (!downloadResponse.ok) {
    throw new Error(`Storage download failed: ${downloadResponse.status}`);
  }

  return downloadResponse.arrayBuffer();
};
