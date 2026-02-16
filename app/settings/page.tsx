"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { SiteHeader } from "@/components/ui/site-header";
import { SiteFooter } from "@/components/ui/site-footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import * as Dialog from "@radix-ui/react-dialog";
import {
  X,
  Eye,
  EyeOff,
  CheckCircle2,
  Circle,
  KeyRound,
  Settings,
} from "lucide-react";

const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export default function SettingsPage() {
  const router = useRouter();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isPasswordOpen, setIsPasswordOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [error, setError] = useState<string>("");
  const [passwordError, setPasswordError] = useState<string>("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const [user, setUser] = useState<any>(null);
  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const passwordRequirements = {
    minLength: newPassword.length >= 8,
    hasUppercase: /[A-Z]/.test(newPassword),
    hasLowercase: /[a-z]/.test(newPassword),
    hasNumber: /[0-9]/.test(newPassword),
    hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(newPassword),
  };

  const allRequirementsMet = Object.values(passwordRequirements).every(Boolean);
  const passwordsMatch =
    newPassword === confirmPassword && confirmPassword.length > 0;

  const email = user?.email ?? "";

  useEffect(() => {
    const load = async () => {
      setError("");
      const { data, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr) {
        router.push("/login");
        return;
      }
      const u = data.session?.user;
      if (!u) {
        router.push("/login");
        return;
      }
      setUser(u);
      setAvatarUrl(u.user_metadata?.avatar_url ?? "");
      setLoading(false);
    };
    load();
  }, [router]);

  const validateAvatar = (file: File): string | null => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return "Please upload a JPG, PNG, or WEBP image.";
    }
    if (file.size > MAX_AVATAR_SIZE) {
      return `Image is too large. Max ${(MAX_AVATAR_SIZE / (1024 * 1024)).toFixed(0)}MB.`;
    }
    return null;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError("");
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    const err = validateAvatar(file);
    if (err) {
      setSelectedFile(null);
      setError(err);
      return;
    }
    setSelectedFile(file);
  };

  const handleUploadAvatar = async (): Promise<boolean> => {
    if (!user) return false;
    if (!selectedFile) {
      setError("Choose an image first.");
      return false;
    }
    setSavingPhoto(true);
    setError("");
    try {
      const oldPath: string | undefined = user?.user_metadata?.avatar_path;
      const ext = selectedFile.name.split(".").pop()?.toLowerCase() || "jpg";
      const newPath = `${user.id}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("avatars")
        .upload(newPath, selectedFile, {
          upsert: true,
          cacheControl: "3600",
          contentType: selectedFile.type,
        });
      if (uploadErr) throw uploadErr;

      const { data: publicData } = supabase.storage
        .from("avatars")
        .getPublicUrl(newPath);
      const newUrl = publicData.publicUrl;

      const { data: updated, error: updateErr } =
        await supabase.auth.updateUser({
          data: { avatar_url: newUrl, avatar_path: newPath },
        });
      if (updateErr) {
        await supabase.storage.from("avatars").remove([newPath]);
        throw updateErr;
      }

      const updatedUser = updated.user;
      setUser(updatedUser);
      setAvatarUrl(updatedUser?.user_metadata?.avatar_url ?? newUrl);
      setSelectedFile(null);
      const input = document.getElementById(
        "avatar",
      ) as HTMLInputElement | null;
      if (input) input.value = "";

      if (oldPath && oldPath.startsWith(`${user.id}/`) && oldPath !== newPath) {
        const { error: removeErr } = await supabase.storage
          .from("avatars")
          .remove([oldPath]);
        if (removeErr) console.warn("Failed to delete old avatar:", removeErr);
      }
      return true;
    } catch (err: any) {
      console.error(err);
      setError(err?.message ?? "Failed to upload profile picture.");
      return false;
    } finally {
      setSavingPhoto(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const resetPasswordForm = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordError("");
    setPasswordSuccess(false);
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  };

  const handleChangePassword = async () => {
    setPasswordError("");
    setPasswordSuccess(false);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("Please fill in all fields.");
      return;
    }
    if (!allRequirementsMet) {
      setPasswordError("New password does not meet all requirements.");
      return;
    }
    if (!passwordsMatch) {
      setPasswordError("New passwords do not match.");
      return;
    }

    setSavingPassword(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (signInError) {
        setPasswordError("Current password is incorrect.");
        setSavingPassword(false);
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) {
        setPasswordError(updateError.message || "Failed to update password.");
        setSavingPassword(false);
        return;
      }

      setPasswordSuccess(true);
      setTimeout(() => {
        setIsPasswordOpen(false);
        resetPasswordForm();
      }, 2000);
    } catch (err) {
      const error = err as Error;
      setPasswordError(error.message || "An unexpected error occurred.");
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader showNav={true} />

      <main className="flex-1 bg-gray-50 px-6 py-12">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <div className="flex items-start justify-between gap-6">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">
                  Settings
                </h1>
                <p className="text-gray-600 mt-1">
                  Manage your account settings and preferences.
                </p>
              </div>

              <Button
                onClick={handleSignOut}
                variant="outline"
                className="border-gray-300 text-gray-700 hover:bg-gray-100"
                disabled={loading}
              >
                Sign out
              </Button>
            </div>

            {error && (
              <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 text-sm">
                {error}
              </div>
            )}

            {loading ? (
              <div className="mt-8 text-gray-600">Loading settings...</div>
            ) : (
              <div className="mt-8 grid gap-8">
                {/* Profile Picture */}
                <div className="flex items-center gap-6">
                  <div className="relative">
                    <div className="w-20 h-20 rounded-full overflow-hidden border border-gray-200 bg-gray-100 flex items-center justify-center">
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt="Profile"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-gray-500 text-sm">No photo</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsEditOpen(true)}
                      className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center hover:bg-gray-50"
                      aria-label="Edit profile picture"
                    >
                      <Settings className="w-4 h-4 text-gray-700" />
                    </button>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      Profile photo
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      Click the cog to upload a new picture.
                    </p>
                  </div>
                </div>

                {/* Email (read-only) */}
                <div className="border-t border-gray-200 pt-6">
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-gray-500">
                      Email
                    </p>
                    <p className="text-base font-medium text-gray-900 mt-1">
                      {email}
                    </p>
                  </div>
                </div>

                {/* Change Password Section */}
                <div className="border-t border-gray-200 pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        Password
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        Change your account password.
                      </p>
                    </div>
                    <Button
                      onClick={() => setIsPasswordOpen(true)}
                      variant="outline"
                      className="border-gray-300 text-gray-700 hover:bg-gray-100"
                    >
                      <KeyRound className="w-4 h-4 mr-2" />
                      Change password
                    </Button>
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    onClick={() => router.push("/profile")}
                    className="bg-[#0047AB] hover:bg-[#003580] text-white"
                  >
                    Back to profile
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Avatar Upload Dialog */}
      <Dialog.Root open={isEditOpen} onOpenChange={setIsEditOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
          <Dialog.Content className="fixed z-50 left-1/2 top-1/2 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white shadow-lg border border-gray-200 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Dialog.Title className="text-lg font-semibold text-gray-900">
                  Update profile picture
                </Dialog.Title>
                <Dialog.Description className="text-sm text-gray-600 mt-1">
                  Upload a JPG, PNG, or WEBP image (max 5MB).
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center"
                  aria-label="Close"
                  onClick={() => {
                    setError("");
                    setSelectedFile(null);
                    const input = document.getElementById(
                      "avatar",
                    ) as HTMLInputElement | null;
                    if (input) input.value = "";
                  }}
                >
                  <X className="w-4 h-4 text-gray-700" />
                </button>
              </Dialog.Close>
            </div>
            <div className="mt-5 space-y-3">
              <Input
                id="avatar"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleFileChange}
                className="h-11 bg-gray-50 border-gray-200"
              />
              {selectedFile && (
                <p className="text-sm text-gray-700">
                  Selected:{" "}
                  <span className="font-medium">{selectedFile.name}</span>
                </p>
              )}
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700 text-sm">
                  {error}
                </div>
              )}
            </div>
            <div className="mt-6 flex items-center justify-end gap-3">
              <Dialog.Close asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="border-gray-300 text-gray-700 hover:bg-gray-100"
                  disabled={savingPhoto}
                  onClick={() => {
                    setError("");
                    setSelectedFile(null);
                    const input = document.getElementById(
                      "avatar",
                    ) as HTMLInputElement | null;
                    if (input) input.value = "";
                  }}
                >
                  Cancel
                </Button>
              </Dialog.Close>
              <Button
                type="button"
                disabled={!selectedFile || savingPhoto}
                className="bg-[#0047AB] hover:bg-[#003580] text-white"
                onClick={async () => {
                  const ok = await handleUploadAvatar();
                  if (ok) setIsEditOpen(false);
                }}
              >
                {savingPhoto ? "Uploading..." : "Upload"}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Change Password Dialog */}
      <Dialog.Root
        open={isPasswordOpen}
        onOpenChange={(open) => {
          setIsPasswordOpen(open);
          if (!open) resetPasswordForm();
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
          <Dialog.Content className="fixed z-50 left-1/2 top-1/2 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white shadow-lg border border-gray-200 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Dialog.Title className="text-lg font-semibold text-gray-900">
                  Change password
                </Dialog.Title>
                <Dialog.Description className="text-sm text-gray-600 mt-1">
                  Enter your current password and choose a new one.
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center"
                  aria-label="Close"
                >
                  <X className="w-4 h-4 text-gray-700" />
                </button>
              </Dialog.Close>
            </div>

            {passwordSuccess ? (
              <div className="mt-6 flex flex-col items-center py-8">
                <CheckCircle2 className="w-12 h-12 text-green-500 mb-4" />
                <p className="text-lg font-medium text-gray-900">
                  Password updated!
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  Your password has been changed successfully.
                </p>
              </div>
            ) : (
              <>
                <div className="mt-5 space-y-4">
                  <div className="space-y-2">
                    <Label
                      htmlFor="current-password"
                      className="text-sm font-medium text-gray-900"
                    >
                      Current password
                    </Label>
                    <div className="relative">
                      <Input
                        id="current-password"
                        type={showCurrentPassword ? "text" : "password"}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Enter current password"
                        className="h-11 bg-gray-50 border-gray-200 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowCurrentPassword(!showCurrentPassword)
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      >
                        {showCurrentPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="new-password"
                      className="text-sm font-medium text-gray-900"
                    >
                      New password
                    </Label>
                    <div className="relative">
                      <Input
                        id="new-password"
                        type={showNewPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password"
                        className="h-11 bg-gray-50 border-gray-200 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      >
                        {showNewPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {newPassword.length > 0 && (
                    <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                      <p className="text-xs font-medium text-gray-700">
                        Password requirements:
                      </p>
                      <div className="grid grid-cols-1 gap-1.5">
                        {[
                          {
                            met: passwordRequirements.minLength,
                            label: "At least 8 characters",
                          },
                          {
                            met: passwordRequirements.hasUppercase,
                            label: "One uppercase letter",
                          },
                          {
                            met: passwordRequirements.hasLowercase,
                            label: "One lowercase letter",
                          },
                          {
                            met: passwordRequirements.hasNumber,
                            label: "One number",
                          },
                          {
                            met: passwordRequirements.hasSpecialChar,
                            label: "One special character",
                          },
                        ].map((req) => (
                          <div
                            key={req.label}
                            className="flex items-center gap-2"
                          >
                            {req.met ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                            ) : (
                              <Circle className="w-3.5 h-3.5 text-gray-400" />
                            )}
                            <span
                              className={`text-xs ${req.met ? "text-green-700" : "text-gray-600"}`}
                            >
                              {req.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label
                      htmlFor="confirm-password"
                      className="text-sm font-medium text-gray-900"
                    >
                      Confirm new password
                    </Label>
                    <div className="relative">
                      <Input
                        id="confirm-password"
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                        className="h-11 bg-gray-50 border-gray-200 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowConfirmPassword(!showConfirmPassword)
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    {confirmPassword.length > 0 && (
                      <div className="flex items-center gap-2 mt-1">
                        {passwordsMatch ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                            <span className="text-xs text-green-700">
                              Passwords match
                            </span>
                          </>
                        ) : (
                          <>
                            <Circle className="w-3.5 h-3.5 text-red-400" />
                            <span className="text-xs text-red-600">
                              Passwords do not match
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {passwordError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700 text-sm">
                      {passwordError}
                    </div>
                  )}
                </div>

                <div className="mt-6 flex items-center justify-end gap-3">
                  <Dialog.Close asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="border-gray-300 text-gray-700 hover:bg-gray-100"
                      disabled={savingPassword}
                    >
                      Cancel
                    </Button>
                  </Dialog.Close>
                  <Button
                    type="button"
                    disabled={
                      !allRequirementsMet ||
                      !passwordsMatch ||
                      !currentPassword ||
                      savingPassword
                    }
                    className="bg-[#0047AB] hover:bg-[#003580] text-white"
                    onClick={handleChangePassword}
                  >
                    {savingPassword ? "Updating..." : "Update password"}
                  </Button>
                </div>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <SiteFooter />
    </div>
  );
}
