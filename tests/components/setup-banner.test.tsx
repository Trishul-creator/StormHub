import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/mode", () => ({
  isDemoMode: () => false,
  isSupabaseMode: () => true,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

import { SetupBanner } from "@/components/layout/setup-banner";

function adminClient(error: { message: string } | null) {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        limit: vi.fn().mockResolvedValue({ error }),
      })),
    })),
  };
}

describe("SetupBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not claim tables are missing when the service-role schema probe succeeds", async () => {
    mocks.createAdminClient.mockReturnValue(adminClient(null));
    const element = await SetupBanner();
    expect(element).toBeNull();
  });

  it("shows setup guidance only when the schema probe actually fails", async () => {
    mocks.createAdminClient.mockReturnValue(adminClient({ message: "relation schools missing" }));
    render(await SetupBanner());
    expect(screen.getByText(/database tables are missing or incomplete/i)).toBeVisible();
  });
});
