import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GoogleDrivePicker } from "@/components/coursework/google-drive-picker";

const setMode = vi.fn();
const setSize = vi.fn();
const setTitle = vi.fn();
const setVisible = vi.fn();
const addView = vi.fn();
const scrollTo = vi.fn();
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

class DocsUploadView {}

class PickerBuilder {
  addView(view: unknown) {
    addView(view);
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

  setTitle(title: string) {
    setTitle(title);
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
    setTitle.mockReset();
    setVisible.mockReset();
    addView.mockReset();
    scrollTo.mockReset();
    pickerCallback = null;
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_DRIVE_API_KEY", "picker-key");
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_DRIVE_APP_ID", "123456789");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ accessToken: "drive-token" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    ));
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
      window.setTimeout(() => callback(0), 0);
      return 1;
    }));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    Object.defineProperty(window, "scrollX", { configurable: true, writable: true, value: 24 });
    Object.defineProperty(window, "scrollY", { configurable: true, writable: true, value: 640 });
    Object.defineProperty(window, "scrollTo", { configurable: true, value: scrollTo });
    Object.defineProperty(window, "gapi", {
      configurable: true,
      value: { load: (_name: string, callback: () => void) => callback() },
    });
    Object.defineProperty(window, "google", {
      configurable: true,
      value: {
        picker: {
          Action: { PICKED: "picked", CANCEL: "cancel", ERROR: "error" },
          DocsViewMode: { LIST: "list" },
          Feature: { MULTISELECT_ENABLED: "multiselect" },
          ViewId: { DOCS: "docs" },
          DocsView,
          DocsUploadView,
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
    expect(setSize).toHaveBeenCalledWith(900, 560);
    expect(setTitle).toHaveBeenCalledWith("Choose assignment materials");
    expect(addView).toHaveBeenCalledTimes(2);
    expect(addView.mock.calls[1][0]).toBeInstanceOf(DocsUploadView);

    pickerCallback?.({ action: "error" });

    expect(setVisible).toHaveBeenLastCalledWith(false);
    expect(await screen.findByText(/could not load your files/i)).toBeVisible();
  });

  it("keeps the assignment page in place until the Picker is closed", async () => {
    render(<GoogleDrivePicker onPicked={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Add from Google Drive" }));
    await waitFor(() => expect(setVisible).toHaveBeenCalledWith(true));

    Object.defineProperty(window, "scrollY", { configurable: true, writable: true, value: 1200 });
    window.dispatchEvent(new Event("scroll"));
    await waitFor(() => expect(scrollTo).toHaveBeenCalledWith(24, 640));

    scrollTo.mockReset();
    pickerCallback?.({ action: "cancel" });
    expect(scrollTo).toHaveBeenCalledWith(24, 640);

    scrollTo.mockReset();
    window.dispatchEvent(new Event("scroll"));
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
