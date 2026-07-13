import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ConnectorsWorkspace } from "../components/ConnectorsWorkspace";

import type { ConnectorsApi, ConnectorsOverview } from "../data/ConnectorsApi";

const provider = {
  id: "google-workspace",
  name: "Google Workspace",
  capabilities: ["mail", "calendar", "drive"],
  executionMode: "provider_api",
  availability: "preview",
  configured: true,
} as const;

const unavailableProviders = [
  {
    id: "notion",
    name: "Notion",
    capabilities: ["notion"],
    executionMode: "provider_api",
    availability: "preview",
    configured: false,
  },
  {
    id: "slack",
    name: "Slack",
    capabilities: ["slack"],
    executionMode: "provider_api",
    availability: "preview",
    configured: false,
  },
  {
    id: "github",
    name: "GitHub",
    capabilities: ["github"],
    executionMode: "provider_api",
    availability: "preview",
    configured: false,
  },
] as const;

const disconnected: ConnectorsOverview = {
  providers: [provider, ...unavailableProviders],
  connections: [],
};

const connected: ConnectorsOverview = {
  providers: [provider, ...unavailableProviders],
  connections: [
    {
      id: "connection-1",
      providerId: provider.id,
      accountId: "account-1",
      accountName: "Ada",
      accountEmail: "ada@example.com",
      accountAvatarUrl: null,
      capabilities: ["mail", "calendar", "drive"],
      scopes: [],
      createdAt: 1,
      updatedAt: 1,
    },
  ],
};

describe("ConnectorsWorkspace", () => {
  it("connects an available provider and reflects its shared capabilities", async () => {
    const api = {
      getOverview: vi.fn().mockResolvedValue(disconnected),
      connect: vi.fn().mockResolvedValue(connected),
      disconnect: vi.fn().mockResolvedValue(undefined),
    } as unknown as ConnectorsApi;

    render(<ConnectorsWorkspace api={api} onSignIn={vi.fn()} />);

    const connectMail = await screen.findByRole("button", {
      name: "Connect Google Workspace for Mail",
    });
    fireEvent.click(connectMail);

    await waitFor(() => {
      expect(api.connect).toHaveBeenCalledWith("google-workspace");
      expect(screen.getAllByText("Connected")).toHaveLength(3);
      expect(screen.getAllByText("ada@example.com")).toHaveLength(3);
    });
  });

  it("offers sign-in without attempting authenticated requests", async () => {
    const onSignIn = vi.fn().mockResolvedValue(undefined);

    render(<ConnectorsWorkspace api={null} onSignIn={onSignIn} />);

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => {
      expect(onSignIn).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
    });
  });

  it("shows configured state without connecting unavailable providers", async () => {
    const api = {
      getOverview: vi.fn().mockResolvedValue(disconnected),
      connect: vi.fn(),
      disconnect: vi.fn(),
    } as unknown as ConnectorsApi;

    render(<ConnectorsWorkspace api={api} onSignIn={vi.fn()} />);

    expect(await screen.findAllByText("Not available")).toHaveLength(3);
    expect(
      screen.queryByRole("button", { name: "Connect Notion for Notion" }),
    ).not.toBeInTheDocument();
    expect(api.connect).not.toHaveBeenCalled();
  });
});
