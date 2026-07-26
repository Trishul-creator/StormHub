"use client";

import { useCallback, useState } from "react";
import { Cloud, Loader2, PlugZap } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface PickedGoogleDriveFile {
  id: string;
  name: string;
  mimeType?: string;
  url?: string;
  sizeBytes?: number;
}

interface PickerDocument {
  id: string;
  name: string;
  mimeType?: string;
  url?: string;
  sizeBytes?: number;
}

interface PickerCallbackData {
  action?: string;
  docs?: PickerDocument[];
}

interface GooglePickerBuilder {
  addView(view: unknown): GooglePickerBuilder;
  enableFeature(feature: string): GooglePickerBuilder;
  setOAuthToken(token: string): GooglePickerBuilder;
  setDeveloperKey(key: string): GooglePickerBuilder;
  setAppId(appId: string): GooglePickerBuilder;
  setOrigin(origin: string): GooglePickerBuilder;
  setCallback(callback: (data: PickerCallbackData) => void): GooglePickerBuilder;
  build(): { setVisible(value: boolean): void };
}

interface GooglePickerApi {
  Action: { PICKED: string };
  Feature: { MULTISELECT_ENABLED: string };
  ViewId: { DOCS: string };
  DocsView: new (viewId: string) => {
    setIncludeFolders(value: boolean): unknown;
    setSelectFolderEnabled(value: boolean): unknown;
  };
  PickerBuilder: new () => GooglePickerBuilder;
}

declare global {
  interface Window {
    gapi?: {
      load(name: string, callback: () => void): void;
    };
    google?: {
      picker: GooglePickerApi;
    };
  }
}

let pickerScriptPromise: Promise<void> | null = null;

function loadPickerScript(): Promise<void> {
  if (window.gapi) return Promise.resolve();
  if (pickerScriptPromise) return pickerScriptPromise;
  pickerScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://apis.google.com/js/api.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load Google Picker."));
    document.head.appendChild(script);
  });
  return pickerScriptPromise;
}

function loadPickerApi(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!window.gapi) {
      reject(new Error("Google Picker is unavailable."));
      return;
    }
    window.gapi.load("picker", resolve);
  });
}

export function GoogleDrivePicker({
  onPicked,
  multiple = true,
  disabled = false,
  returnTo,
  label = "Add from Google Drive",
  showConfigurationHint = true,
}: {
  onPicked: (files: PickedGoogleDriveFile[]) => void | Promise<void>;
  multiple?: boolean;
  disabled?: boolean;
  returnTo?: string;
  label?: string;
  showConfigurationHint?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [needsConnection, setNeedsConnection] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_API_KEY?.trim();
  const appId = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_APP_ID?.trim();
  const pickerConfigured = Boolean(apiKey && appId);

  const openPicker = useCallback(async () => {
    if (!apiKey || !appId) {
      setError("Google Drive needs to be configured by an administrator.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const tokenResponse = await fetch("/api/integrations/google-drive/token", {
        cache: "no-store",
      });
      const tokenPayload = await tokenResponse.json() as {
        accessToken?: string;
        error?: string;
        reconnect?: boolean;
      };
      if (!tokenResponse.ok || !tokenPayload.accessToken) {
        if (tokenPayload.reconnect || tokenResponse.status === 401) setNeedsConnection(true);
        throw new Error(tokenPayload.error || "Could not connect to Google Drive.");
      }
      await loadPickerScript();
      await loadPickerApi();
      const pickerApi = window.google?.picker;
      if (!pickerApi) throw new Error("Google Picker is unavailable.");
      const view = new pickerApi.DocsView(pickerApi.ViewId.DOCS);
      view.setIncludeFolders(false);
      view.setSelectFolderEnabled(false);
      let builder = new pickerApi.PickerBuilder()
        .addView(view)
        .setOAuthToken(tokenPayload.accessToken)
        .setDeveloperKey(apiKey)
        .setAppId(appId)
        .setOrigin(window.location.origin)
        .setCallback((data) => {
          if (data.action !== pickerApi.Action.PICKED || !data.docs) return;
          void onPicked(data.docs.map((file) => ({
            id: file.id,
            name: file.name,
            mimeType: file.mimeType,
            url: file.url,
            sizeBytes: file.sizeBytes,
          })));
        });
      if (multiple) builder = builder.enableFeature(pickerApi.Feature.MULTISELECT_ENABLED);
      builder.build().setVisible(true);
    } catch (pickerError) {
      setError(pickerError instanceof Error ? pickerError.message : "Could not open Google Drive.");
    } finally {
      setLoading(false);
    }
  }, [apiKey, appId, multiple, onPicked]);

  if (needsConnection) {
    const destination = returnTo || (typeof window !== "undefined"
      ? `${window.location.pathname}${window.location.search}`
      : "/settings");
    return (
      <div>
        <Button variant="outline" asChild>
          <a href={`/api/integrations/google-drive/connect?returnTo=${encodeURIComponent(destination)}`}>
            <PlugZap className="h-4 w-4" /> Connect Google Drive
          </a>
        </Button>
        {error && <p className="mt-2 text-xs text-amber-700">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      <Button
        type="button"
        variant="outline"
        onClick={openPicker}
        disabled={disabled || loading || !pickerConfigured}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cloud className="h-4 w-4" />}
        {loading ? "Opening Drive..." : label}
      </Button>
      {!pickerConfigured && showConfigurationHint && (
        <p className="mt-2 text-xs text-muted-foreground">Google Drive has not been enabled for this environment.</p>
      )}
      {error && !needsConnection && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}
