import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MfaSetup } from "@/components/auth/mfa-setup";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
  getAuthenticatorAssuranceLevel: vi.fn(),
  listFactors: vi.fn(),
  unenroll: vi.fn(),
  enroll: vi.fn(),
  challenge: vi.fn(),
  verify: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
  useSearchParams: () => new URLSearchParams("redirect=/admin"),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      mfa: {
        getAuthenticatorAssuranceLevel: mocks.getAuthenticatorAssuranceLevel,
        listFactors: mocks.listFactors,
        unenroll: mocks.unenroll,
        enroll: mocks.enroll,
        challenge: mocks.challenge,
        verify: mocks.verify,
      },
    },
  }),
}));

describe("MfaSetup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: "aal1" },
      error: null,
    });
    mocks.listFactors.mockResolvedValue({ data: { totp: [] }, error: null });
    mocks.unenroll.mockResolvedValue({ data: {}, error: null });
    mocks.enroll.mockResolvedValue({
      data: {
        id: "new-factor",
        totp: {
          qr_code: "data:image/svg+xml;utf-8,<svg width=\"219\" height=\"219\"></svg>\n ",
          secret: "TESTSECRET",
          uri: "otpauth://totp/StormHub%3Atest%40example.com?secret=TESTSECRET&issuer=StormHub",
        },
      },
      error: null,
    });
  });

  it("encodes Supabase SVG QR data before rendering it", async () => {
    render(<MfaSetup />);

    fireEvent.click(await screen.findByRole("button", { name: /set up authenticator/i }));

    expect(await screen.findByText("Manual key: TESTSECRET")).toBeVisible();
    const image = screen.getByRole("img", { name: /authenticator setup qr code/i });
    expect(image.getAttribute("src")).toContain("%3Csvg%20width%3D%22219%22");
    expect(image.getAttribute("src")).not.toContain("\n");
    expect(image).toHaveAttribute("width", "219");
    expect(image).toHaveAttribute("height", "219");
    expect(screen.getByRole("link", { name: /open authenticator app/i })).toHaveAttribute(
      "href",
      "otpauth://totp/StormHub%3Atest%40example.com?secret=TESTSECRET&issuer=StormHub"
    );
    expect(mocks.enroll).toHaveBeenCalledWith({
      factorType: "totp",
      friendlyName: "StormHub administrator",
      issuer: "StormHub",
    });
  });

  it("removes an abandoned unverified factor before starting over", async () => {
    mocks.listFactors.mockResolvedValue({
      data: { totp: [{ id: "stale-factor", status: "unverified" }] },
      error: null,
    });

    render(<MfaSetup />);
    fireEvent.click(await screen.findByRole("button", { name: /set up authenticator/i }));

    await waitFor(() => {
      expect(mocks.unenroll).toHaveBeenCalledWith({ factorId: "stale-factor" });
      expect(mocks.enroll).toHaveBeenCalledAfter(mocks.unenroll);
    });
  });

  it("does not render a deep link for a non-authenticator URI", async () => {
    mocks.enroll.mockResolvedValue({
      data: {
        id: "new-factor",
        totp: {
          qr_code: "data:image/svg+xml;utf-8,<svg width=\"219\" height=\"219\"></svg>",
          secret: "TESTSECRET",
          uri: "https://example.com/not-an-authenticator-link",
        },
      },
      error: null,
    });

    render(<MfaSetup />);
    fireEvent.click(await screen.findByRole("button", { name: /set up authenticator/i }));

    expect(await screen.findByText("Manual key: TESTSECRET")).toBeVisible();
    expect(screen.queryByRole("link", { name: /open authenticator app/i })).not.toBeInTheDocument();
  });
});
