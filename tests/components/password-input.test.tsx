import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PasswordInput } from "@/components/auth/password-input";
import { Label } from "@/components/ui/label";

describe("PasswordInput", () => {
  it("lets a user reveal and hide a password without changing its value", () => {
    render(
      <>
        <Label htmlFor="test-password">Password</Label>
        <PasswordInput id="test-password" defaultValue="VisiblePassword123" />
      </>
    );

    const input = screen.getByLabelText("Password");
    expect(input).toHaveAttribute("type", "password");

    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(input).toHaveAttribute("type", "text");
    expect(input).toHaveValue("VisiblePassword123");

    fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(input).toHaveAttribute("type", "password");
  });
});
