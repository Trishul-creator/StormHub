"use client";

import { useRef, useState, useTransition } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  AlertTriangle,
  Loader2,
  Save,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  deleteEmptyDistrict,
  deleteEmptySchool,
  updateDistrictDetails,
  updateSchoolDetails,
} from "@/lib/actions";
import { AdminReauthenticationDialog } from "@/components/auth/admin-reauthentication-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { needsAdminReauthentication } from "@/lib/admin-step-up-shared";
import type { District, School, UserRole } from "@/types/database";

type ReauthenticationController = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerified: () => void;
  request: (retry: () => void, onCancel?: () => void) => void;
};

function useReauthenticationController(): ReauthenticationController {
  const [open, setOpen] = useState(false);
  const retryRef = useRef<(() => void) | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);
  const completedRef = useRef(false);

  function request(retry: () => void, onCancel?: () => void) {
    retryRef.current = retry;
    cancelRef.current = onCancel ?? null;
    completedRef.current = false;
    setOpen(true);
  }

  function onOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      if (!completedRef.current) cancelRef.current?.();
      retryRef.current = null;
      cancelRef.current = null;
      completedRef.current = false;
    }
    setOpen(nextOpen);
  }

  function onVerified() {
    completedRef.current = true;
    retryRef.current?.();
  }

  return { open, onOpenChange, onVerified, request };
}

function SettingsDialogShell({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-slate-950/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[71] max-h-[calc(100vh-2rem)] w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border bg-card text-card-foreground shadow-2xl">
          <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b bg-card/95 px-5 py-4 backdrop-blur">
            <div>
              <Dialog.Title className="text-xl font-semibold text-storm-navy">
                {title}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                {description}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label={`Close ${title}`}
                className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

type DistrictDraft = {
  name: string;
  slug: string;
  city: string;
  state: string;
  websiteUrl: string;
  isActive: boolean;
};

function districtDraft(district: District): DistrictDraft {
  return {
    name: district.name,
    slug: district.slug,
    city: district.city ?? "",
    state: district.state ?? "",
    websiteUrl: district.website_url ?? "",
    isActive: district.is_active,
  };
}

export function DistrictSettings({
  district,
  actorRole,
  actorEmail,
  schoolCount,
  assignedAccountCount,
}: {
  district: District;
  actorRole: UserRole;
  actorEmail: string;
  schoolCount: number;
  assignedAccountCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [draft, setDraft] = useState(() => districtDraft(district));
  const confirmedDraft = useRef(districtDraft(district));
  const [confirmationName, setConfirmationName] = useState("");
  const [pending, startTransition] = useTransition();
  const reauthentication = useReauthenticationController();
  const canControlWorkspace = actorRole === "super_admin";
  const isEmpty = schoolCount === 0 && assignedAccountCount === 0;

  function reset() {
    setDraft(confirmedDraft.current);
    setConfirmationName("");
  }

  function closeSettings() {
    reset();
    setOpen(false);
  }

  function save() {
    startTransition(async () => {
      const result = await updateDistrictDetails({
        districtId: district.id,
        ...draft,
      });
      if (!result.success || !result.district) {
        if (needsAdminReauthentication(result)) {
          reauthentication.request(save, reset);
          return;
        }
        reset();
        toast({
          title: "Could not update district",
          description: result.error,
          variant: "destructive",
        });
        return;
      }

      const nextDraft = { ...draft, slug: result.district.slug };
      confirmedDraft.current = nextDraft;
      setDraft(nextDraft);
      setOpen(false);
      toast({ title: "District updated", description: "The workspace settings were saved." });
      if (result.district.slug !== district.slug) {
        router.replace(`/admin/districts/${result.district.slug}`, { scroll: false });
      } else {
        router.refresh();
      }
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteEmptyDistrict({
        districtId: district.id,
        confirmationName,
      });
      if (!result.success) {
        if (needsAdminReauthentication(result)) {
          reauthentication.request(remove, () => {
            setConfirmationName("");
            setDeleteOpen(false);
          });
          return;
        }
        toast({
          title: "District was not deleted",
          description: result.error,
          variant: "destructive",
        });
        return;
      }
      toast({ title: "District permanently deleted" });
      setDeleteOpen(false);
      setOpen(false);
      router.replace("/admin/districts", { scroll: false });
      router.refresh();
    });
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <Settings className="h-4 w-4" />
        District settings
      </Button>
      <SettingsDialogShell
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) reset();
          setOpen(nextOpen);
        }}
        title="District settings"
        description="Update identity and location. Platform controls are restricted to super admins."
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
          className="grid gap-4 p-5 md:grid-cols-2"
        >
          <Field
            label="District name"
            value={draft.name}
            onChange={(name) => setDraft((current) => ({ ...current, name }))}
            required
          />
          {canControlWorkspace && (
            <Field
              label="Workspace URL name"
              value={draft.slug}
              onChange={(slug) => setDraft((current) => ({ ...current, slug }))}
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              required
              hint="Lowercase letters, numbers, and single hyphens."
            />
          )}
          <Field
            label="City"
            value={draft.city}
            onChange={(city) => setDraft((current) => ({ ...current, city }))}
          />
          <Field
            label="State"
            value={draft.state}
            onChange={(state) => setDraft((current) => ({ ...current, state }))}
            pattern="[A-Za-z][A-Za-z .-]{1,49}"
          />
          <div className="md:col-span-2">
            <Field
              label="District website"
              value={draft.websiteUrl}
              onChange={(websiteUrl) => setDraft((current) => ({ ...current, websiteUrl }))}
              type="url"
              placeholder="https://www.example.org"
            />
          </div>
          {canControlWorkspace && (
            <label className="flex items-start gap-3 rounded-xl border p-3 text-sm md:col-span-2">
              <input
                type="checkbox"
                checked={draft.isActive}
                onChange={(event) => setDraft((current) => ({
                  ...current,
                  isActive: event.target.checked,
                }))}
                className="mt-1"
              />
              <span>
                <strong className="text-foreground">District active</strong>
                <span className="mt-0.5 block text-muted-foreground">
                  Turn this off to pause normal workspace access without deleting records.
                </span>
              </span>
            </label>
          )}
          <div className="flex flex-wrap justify-end gap-2 border-t pt-4 md:col-span-2">
            <Button type="button" variant="ghost" onClick={closeSettings} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !draft.name.trim()}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save changes
            </Button>
          </div>
        </form>

        {canControlWorkspace && (
          <div className="border-t border-destructive/20 bg-destructive/[0.03] p-5">
            <div className="flex items-start gap-3">
              <Trash2 className="mt-0.5 h-5 w-5 text-destructive" />
              <div className="flex-1">
                <h3 className="font-semibold text-destructive">Danger zone</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {isEmpty
                    ? "This empty district can be permanently deleted."
                    : `Permanent deletion is blocked while this district has ${schoolCount} school${schoolCount === 1 ? "" : "s"} or ${assignedAccountCount} assigned account${assignedAccountCount === 1 ? "" : "s"}.`}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {isEmpty ? (
                    <Button type="button" variant="destructive" onClick={() => setDeleteOpen(true)}>
                      <Trash2 className="h-4 w-4" />
                      Permanently delete district
                    </Button>
                  ) : (
                    <Button type="button" variant="outline" onClick={() => router.push("/admin/offboarding")}>
                      Open Tenant offboarding
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </SettingsDialogShell>

      <DeleteConfirmation
        open={deleteOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setConfirmationName("");
          setDeleteOpen(nextOpen);
        }}
        kind="district"
        name={district.name}
        value={confirmationName}
        onValueChange={setConfirmationName}
        onDelete={remove}
        pending={pending}
      />
      <AdminReauthenticationDialog
        open={reauthentication.open}
        onOpenChange={reauthentication.onOpenChange}
        email={actorEmail}
        onVerified={reauthentication.onVerified}
      />
    </>
  );
}

type SchoolDraft = {
  name: string;
  shortName: string;
  slug: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  websiteUrl: string;
  logoUrl: string;
  mascot: string;
  primaryColor: string;
  secondaryColor: string;
  isActive: boolean;
  isPublic: boolean;
};

function schoolDraft(school: School): SchoolDraft {
  return {
    name: school.name,
    shortName: school.short_name ?? "",
    slug: school.slug,
    address: school.address ?? "",
    city: school.city ?? "",
    state: school.state ?? "",
    zip: school.zip ?? "",
    websiteUrl: school.website_url ?? "",
    logoUrl: school.logo_url ?? "",
    mascot: school.mascot ?? "",
    primaryColor: school.primary_color ?? "",
    secondaryColor: school.secondary_color ?? "",
    isActive: school.is_active !== false,
    isPublic: school.is_public !== false,
  };
}

export function SchoolSettings({
  school,
  actorRole,
  actorEmail,
}: {
  school: School;
  actorRole: UserRole;
  actorEmail: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [draft, setDraft] = useState(() => schoolDraft(school));
  const confirmedDraft = useRef(schoolDraft(school));
  const [confirmationName, setConfirmationName] = useState("");
  const [pending, startTransition] = useTransition();
  const reauthentication = useReauthenticationController();
  const canControlWorkspace = actorRole === "district_admin" || actorRole === "super_admin";

  function reset() {
    setDraft(confirmedDraft.current);
    setConfirmationName("");
  }

  function closeSettings() {
    reset();
    setOpen(false);
  }

  function save() {
    startTransition(async () => {
      const result = await updateSchoolDetails({
        schoolId: school.id,
        ...draft,
      });
      if (!result.success || !result.school) {
        if (needsAdminReauthentication(result)) {
          reauthentication.request(save, reset);
          return;
        }
        reset();
        toast({
          title: "Could not update school",
          description: result.error,
          variant: "destructive",
        });
        return;
      }
      const nextDraft = { ...draft, slug: result.school.slug };
      confirmedDraft.current = nextDraft;
      setDraft(nextDraft);
      setOpen(false);
      toast({ title: "School updated", description: "The workspace settings were saved." });
      if (result.school.slug !== school.slug) {
        router.replace(`/admin/schools/${result.school.slug}`, { scroll: false });
      } else {
        router.refresh();
      }
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteEmptySchool({
        schoolId: school.id,
        confirmationName,
      });
      if (!result.success) {
        if (needsAdminReauthentication(result)) {
          reauthentication.request(remove, () => {
            setConfirmationName("");
            setDeleteOpen(false);
          });
          return;
        }
        toast({
          title: "School was not deleted",
          description: result.error,
          variant: "destructive",
        });
        return;
      }
      toast({ title: "School permanently deleted" });
      setDeleteOpen(false);
      setOpen(false);
      router.replace(
        result.districtSlug
          ? `/admin/districts/${result.districtSlug}`
          : "/admin/districts",
        { scroll: false }
      );
      router.refresh();
    });
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <Settings className="h-4 w-4" />
        School settings
      </Button>
      <SettingsDialogShell
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) reset();
          setOpen(nextOpen);
        }}
        title="School settings"
        description="Manage identity, location, branding, routing, and workspace availability."
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
          className="grid gap-4 p-5 md:grid-cols-2"
        >
          <Field label="School name" value={draft.name} onChange={(name) => setDraft((current) => ({ ...current, name }))} required />
          <Field label="Short name" value={draft.shortName} onChange={(shortName) => setDraft((current) => ({ ...current, shortName }))} />
          {canControlWorkspace && (
            <div className="md:col-span-2">
              <Field
                label="Workspace URL name"
                value={draft.slug}
                onChange={(slug) => setDraft((current) => ({ ...current, slug }))}
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                required
                hint="Changing this updates public and administrative school URLs."
              />
            </div>
          )}
          <div className="md:col-span-2">
            <Field label="Street address" value={draft.address} onChange={(address) => setDraft((current) => ({ ...current, address }))} />
          </div>
          <Field label="City" value={draft.city} onChange={(city) => setDraft((current) => ({ ...current, city }))} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="State" value={draft.state} onChange={(state) => setDraft((current) => ({ ...current, state }))} pattern="[A-Za-z][A-Za-z .-]{1,49}" />
            <Field label="ZIP code" value={draft.zip} onChange={(zip) => setDraft((current) => ({ ...current, zip }))} />
          </div>
          <Field label="School website" value={draft.websiteUrl} onChange={(websiteUrl) => setDraft((current) => ({ ...current, websiteUrl }))} type="url" placeholder="https://www.example.org" />
          <Field label="Logo URL" value={draft.logoUrl} onChange={(logoUrl) => setDraft((current) => ({ ...current, logoUrl }))} type="url" placeholder="https://www.example.org/logo.png" />
          <Field label="Mascot" value={draft.mascot} onChange={(mascot) => setDraft((current) => ({ ...current, mascot }))} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Primary color" value={draft.primaryColor} onChange={(primaryColor) => setDraft((current) => ({ ...current, primaryColor }))} pattern="#[0-9A-Fa-f]{6}" placeholder="#123ABC" />
            <Field label="Secondary color" value={draft.secondaryColor} onChange={(secondaryColor) => setDraft((current) => ({ ...current, secondaryColor }))} pattern="#[0-9A-Fa-f]{6}" placeholder="#FFFFFF" />
          </div>
          {canControlWorkspace && (
            <div className="grid gap-3 md:col-span-2 md:grid-cols-2">
              <WorkspaceToggle
                label="School active"
                description="Allow normal use of this workspace."
                checked={draft.isActive}
                onChange={(isActive) => setDraft((current) => ({ ...current, isActive }))}
              />
              <WorkspaceToggle
                label="Publicly listed"
                description="Show this school in permitted public listings."
                checked={draft.isPublic}
                onChange={(isPublic) => setDraft((current) => ({ ...current, isPublic }))}
              />
            </div>
          )}
          <div className="flex flex-wrap justify-end gap-2 border-t pt-4 md:col-span-2">
            <Button type="button" variant="ghost" onClick={closeSettings} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !draft.name.trim()}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save changes
            </Button>
          </div>
        </form>

        {canControlWorkspace && (
          <div className="border-t border-destructive/20 bg-destructive/[0.03] p-5">
            <div className="flex items-start gap-3">
              <Trash2 className="mt-0.5 h-5 w-5 text-destructive" />
              <div className="flex-1">
                <h3 className="font-semibold text-destructive">Danger zone</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Empty workspaces can be deleted immediately. StormHub blocks direct deletion
                  when a school contains accounts or activity and sends you to Tenant offboarding.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" variant="destructive" onClick={() => setDeleteOpen(true)}>
                    <Trash2 className="h-4 w-4" />
                    Permanently delete empty school
                  </Button>
                  <Button type="button" variant="outline" onClick={() => router.push("/admin/offboarding")}>
                    Offboard populated school
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </SettingsDialogShell>

      <DeleteConfirmation
        open={deleteOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setConfirmationName("");
          setDeleteOpen(nextOpen);
        }}
        kind="school"
        name={school.name}
        value={confirmationName}
        onValueChange={setConfirmationName}
        onDelete={remove}
        pending={pending}
      />
      <AdminReauthenticationDialog
        open={reauthentication.open}
        onOpenChange={reauthentication.onOpenChange}
        email={actorEmail}
        onVerified={reauthentication.onVerified}
      />
    </>
  );
}

function Field({
  label,
  value,
  onChange,
  hint,
  ...inputProps
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  type?: React.HTMLInputTypeAttribute;
  required?: boolean;
  pattern?: string;
  placeholder?: string;
}) {
  const id = `organization-${label.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}`;
  return (
    <label htmlFor={id} className="block text-sm">
      <span className="font-medium text-foreground">{label}</span>
      <input
        {...inputProps}
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-foreground"
      />
      {hint && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

function WorkspaceToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 rounded-xl border p-3 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1"
      />
      <span>
        <strong className="text-foreground">{label}</strong>
        <span className="mt-0.5 block text-muted-foreground">{description}</span>
      </span>
    </label>
  );
}

function DeleteConfirmation({
  open,
  onOpenChange,
  kind,
  name,
  value,
  onValueChange,
  onDelete,
  pending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: "district" | "school";
  name: string;
  value: string;
  onValueChange: (value: string) => void;
  onDelete: () => void;
  pending: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-slate-950/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[81] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-card p-6 text-card-foreground shadow-2xl">
          <Dialog.Close asChild>
            <button
              type="button"
              aria-label={`Cancel ${kind} deletion`}
              className="absolute right-4 top-4 rounded-lg p-2 text-muted-foreground hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
          </Dialog.Close>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <Dialog.Title className="mt-4 text-xl font-semibold text-storm-navy">
            Permanently delete this {kind}?
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">
            This is only allowed for an empty {kind}. Type <strong className="text-foreground">{name}</strong>{" "}
            exactly. You will then confirm your administrator identity.
          </Dialog.Description>
          <div className="mt-5">
            <Label htmlFor={`delete-${kind}-confirmation`}>Confirm {kind} name</Label>
            <input
              id={`delete-${kind}-confirmation`}
              value={value}
              onChange={(event) => onValueChange(event.target.value)}
              autoComplete="off"
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-foreground"
            />
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button type="button" variant="ghost" disabled={pending}>Cancel</Button>
            </Dialog.Close>
            <Button
              type="button"
              variant="destructive"
              disabled={pending || value !== name}
              onClick={onDelete}
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Permanently delete
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
