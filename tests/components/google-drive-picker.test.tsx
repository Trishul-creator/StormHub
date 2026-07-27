import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GoogleDrivePicker } from "@/components/coursework/google-drive-picker";

const setMode = vi.fn();
const setSize = vi.fn();
const setVisible = vi.fn();
let pickerCallback: ((data: { action?: string; docs?: unknown[] }) => void) | null = null;

class DocsView {
  setIncludeFolders() {
    return this;
  }

  setSelectFolderEnabled() {
    return this;
  }

  setMode(mode: string) {
    setMode(mode);
    return this;
  }
}

class PickerBuilder {
  addView() {
    return this;
  }

  enableFeature() {
    return this;
  }

  setOAuthToken() {
    return this;
  }

  setDeveloperKey() {
    return this;
  }

  setAppId() {
    return this;
  }

  setOrigin() {
    return this;
  }

  setSize(width: number, height: number) {
    setSize(width, height);
    return this;
  }

  setCallback(callback: typeof pickerCallback) {
    pickerCallback = callback;
    return this;
  }

  build() {
    return { setVisible };
  }
}

describe("GoogleDrivePicker", () => {
  beforeEach(() => {
    setMode.mockReset();
    setSize.mockReset();
    setVisible.mockReset();
    pickerCallback = null;
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_DRIVE_API_KEY", "picker-key");
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_DRIVE_APP_ID", "123456789");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ accessToken: "drive-token" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    ));
    Object.defineProperty(window, "gapi", {
      configurable: true,
      value: { load: (_name: string, callback: () => void) => callback() },
    });
    Object.defineProperty(window, "google", {
      configurable: true,
      value: {
        picker: {
          Action: { PICKED: "picked", ERROR: "error" },
          DocsViewMode: { LIST: "list" },
          Feature: { MULTISELECT_ENABLED: "multiselect" },
          ViewId: { DOCS: "docs" },
          DocsView,
          PickerBuilder,
        },
      },
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(window, "gapi");
    Reflect.deleteProperty(window, "google");
  });

  it("uses a list view for drive.file access and reports Picker failures", async () => {
    render(<GoogleDrivePicker onPicked={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Add from Google Drive" }));

    await waitFor(() => expect(setVisible).toHaveBeenCalledWith(true));
    expect(setMode).toHaveBeenCalledWith("list");
    expect(setSize).toHaveBeenCalled();

    pickerCallback?.({ action: "error" });

    expect(setVisible).toHaveBeenLastCalledWith(false);
    expect(await screen.findByText(/could not load your files/i)).toBeVisible();
  });
});
