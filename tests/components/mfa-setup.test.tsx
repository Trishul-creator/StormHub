import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
    vi.stubEnv("NEXT_PUBLIC_ADMIN_MFA_METHOD", "totp");
    mocks.getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: "aal1" },
      error: null,
    });
    mocks.listFactors.mockResolvedValue({ data: { phone: [], totp: [] }, error: null });
    mocks.unenroll.mockResolvedValue({ data: {}, error: null });
    mocks.challenge.mockResolvedValue({ data: { id: "challenge-id" }, error: null });
    mocks.verify.mockResolvedValue({ data: {}, error: null });
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

  afterEach(() => {
    vi.unstubAllEnvs();
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

  it("normalizes a phone number and verifies the SMS enrollment challenge", async () => {
    vi.stubEnv("NEXT_PUBLIC_ADMIN_MFA_METHOD", "sms");
    mocks.enroll.mockResolvedValue({ data: { id: "phone-factor" }, error: null });

    render(<MfaSetup />);
    fireEvent.change(await screen.findByLabelText(/mobile phone number/i), {
      target: { value: "+1 (312) 555-0198" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send verification code/i }));

    expect(await screen.findByText(/sent to ending in 0198/i)).toBeVisible();
    expect(mocks.enroll).toHaveBeenCalledWith({
      factorType: "phone",
      phone: "+13125550198",
      friendlyName: "ending in 0198",
    });
    expect(mocks.challenge).toHaveBeenCalledWith({
      factorId: "phone-factor",
      channel: "sms",
    });

    fireEvent.change(screen.getByLabelText(/six-digit code/i), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /verify and continue/i }));

    await waitFor(() => {
      expect(mocks.verify).toHaveBeenCalledWith({
        factorId: "phone-factor",
        challengeId: "challenge-id",
        code: "123456",
      });
      expect(mocks.replace).toHaveBeenCalledWith("/admin");
    });
    expect(mocks.challenge).toHaveBeenCalledTimes(1);
  });

  it("requires an E.164 country code before enrolling a phone", async () => {
    vi.stubEnv("NEXT_PUBLIC_ADMIN_MFA_METHOD", "sms");

    render(<MfaSetup />);
    fireEvent.change(await screen.findByLabelText(/mobile phone number/i), {
      target: { value: "312-555-0198" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send verification code/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/with country code/i);
    expect(mocks.enroll).not.toHaveBeenCalled();
  });

  it("challenges an existing verified phone factor only after an explicit send", async () => {
    vi.stubEnv("NEXT_PUBLIC_ADMIN_MFA_METHOD", "sms");
    mocks.listFactors.mockResolvedValue({
      data: {
        phone: [{ id: "verified-phone", status: "verified", friendly_name: "ending in 4421" }],
        totp: [],
      },
      error: null,
    });

    render(<MfaSetup />);
    const sendButton = await screen.findByRole("button", { name: /send text message/i });
    expect(mocks.challenge).not.toHaveBeenCalled();
    fireEvent.click(sendButton);

    expect(await screen.findByText(/sent to ending in 4421/i)).toBeVisible();
    expect(screen.getByRole("button", { name: /send another code in 60s/i })).toBeDisabled();
    expect(mocks.challenge).toHaveBeenCalledWith({
      factorId: "verified-phone",
      channel: "sms",
    });
  });

  it("continues to verify an existing TOTP factor when SMS is the enrollment default", async () => {
    vi.stubEnv("NEXT_PUBLIC_ADMIN_MFA_METHOD", "sms");
    mocks.listFactors.mockResolvedValue({
      data: {
        phone: [],
        totp: [{ id: "verified-totp", status: "verified" }],
      },
      error: null,
    });

    render(<MfaSetup />);
    fireEvent.change(await screen.findByLabelText(/six-digit code/i), { target: { value: "654321" } });
    fireEvent.click(screen.getByRole("button", { name: /verify and continue/i }));

    await waitFor(() => {
      expect(mocks.challenge).toHaveBeenCalledWith({ factorId: "verified-totp" });
      expect(mocks.verify).toHaveBeenCalledWith({
        factorId: "verified-totp",
        challengeId: "challenge-id",
        code: "654321",
      });
    });
  });

  it("keeps an enrolled phone factor retryable when SMS delivery fails", async () => {
    vi.stubEnv("NEXT_PUBLIC_ADMIN_MFA_METHOD", "sms");
    mocks.enroll.mockResolvedValue({ data: { id: "retry-phone" }, error: null });
    mocks.challenge.mockResolvedValueOnce({
      data: null,
      error: { message: "provider unavailable" },
    });

    render(<MfaSetup />);
    fireEvent.change(await screen.findByLabelText(/mobile phone number/i), {
      target: { value: "+13125550198" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send verification code/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/could not be sent/i);
    expect(screen.getByRole("button", { name: /send text message/i })).toBeVisible();
    expect(screen.queryByLabelText(/six-digit code/i)).not.toBeInTheDocument();
  });

  it("shows a recoverable error when Supabase rejects an SMS code", async () => {
    vi.stubEnv("NEXT_PUBLIC_ADMIN_MFA_METHOD", "sms");
    mocks.enroll.mockResolvedValue({ data: { id: "phone-factor" }, error: null });
    mocks.verify.mockResolvedValue({ data: null, error: { message: "invalid code" } });

    render(<MfaSetup />);
    fireEvent.change(await screen.findByLabelText(/mobile phone number/i), {
      target: { value: "+13125550198" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send verification code/i }));
    fireEvent.change(await screen.findByLabelText(/six-digit code/i), {
      target: { value: "000000" },
    });
    fireEvent.click(screen.getByRole("button", { name: /verify and continue/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/not accepted/i);
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/six-digit code/i)).toBeVisible();
  });

  it("continues immediately when the session is already at AAL2", async () => {
    mocks.getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: "aal2" },
      error: null,
    });

    render(<MfaSetup />);

    await waitFor(() => {
      expect(mocks.replace).toHaveBeenCalledWith("/admin");
      expect(mocks.refresh).toHaveBeenCalled();
    });
    expect(mocks.enroll).not.toHaveBeenCalled();
  });
});
