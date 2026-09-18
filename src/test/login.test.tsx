/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import Login from "../pages/Login";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

let mockAuthUser: { id: string } | null = null;
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: mockAuthUser, isConfigured: true }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

let recoveryCallback: ((event: string, session: unknown) => void) | undefined;

vi.mock("@/lib/supabase", () => {
  const mockSupabase = {
    auth: {
      signInWithOAuth: vi.fn(),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      updateUser: vi.fn(),
      onAuthStateChange: vi.fn((cb: (event: string, session: unknown) => void) => {
        recoveryCallback = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
    },
  };
  return { supabase: mockSupabase, isSupabaseConfigured: true };
});

import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

describe("Login - Forgot Password flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    recoveryCallback = undefined;
    mockAuthUser = null;
  });

  it("switches to the 'forgot password' screen when the link is clicked", () => {
    render(<Login />);
    fireEvent.click(screen.getByRole("button", { name: /forgot password/i }));
    expect(screen.getByRole("button", { name: /send reset link/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/^password$/i)).not.toBeInTheDocument();
  });

  it("sends a reset email for a valid address", async () => {
    (supabase.auth.resetPasswordForEmail as any).mockResolvedValue({ error: null });
    render(<Login />);
    fireEvent.click(screen.getByRole("button", { name: /forgot password/i }));
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "user@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /send reset link/i }));

    await waitFor(() => {
      expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith("user@example.com", {
        redirectTo: `${window.location.origin}/login`,
      });
    });
    expect(toast.success).toHaveBeenCalled();
  });

  it("does not call Supabase when the reset email field is empty", () => {
    render(<Login />);
    fireEvent.click(screen.getByRole("button", { name: /forgot password/i }));
    fireEvent.click(screen.getByRole("button", { name: /send reset link/i }));
    expect(supabase.auth.resetPasswordForEmail).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });

  it("returns to sign in from the forgot-password screen", () => {
    render(<Login />);
    fireEvent.click(screen.getByRole("button", { name: /forgot password/i }));
    fireEvent.click(screen.getByRole("button", { name: /back to sign in/i }));
    expect(screen.getByRole("button", { name: /sign in with email/i })).toBeInTheDocument();
  });

  it("switches to 'set new password' when Supabase fires a PASSWORD_RECOVERY event", () => {
    render(<Login />);
    expect(recoveryCallback).toBeDefined();
    act(() => recoveryCallback!("PASSWORD_RECOVERY", {}));
    expect(screen.getByRole("button", { name: /update password/i })).toBeInTheDocument();
  });

  it("updates the password and signs the user in when both fields match", async () => {
    (supabase.auth.updateUser as any).mockResolvedValue({ error: null });
    render(<Login />);
    act(() => recoveryCallback!("PASSWORD_RECOVERY", {}));

    fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: "newpass123" } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: "newpass123" } });
    fireEvent.click(screen.getByRole("button", { name: /update password/i }));

    await waitFor(() => {
      expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: "newpass123" });
    });
    expect(mockNavigate).toHaveBeenCalledWith("/");
  });

  it("does not navigate away when the recovery session sets `user` mid-reset", () => {
    const { rerender } = render(<Login />);
    act(() => recoveryCallback!("PASSWORD_RECOVERY", {}));

    // A recovery link establishes a real Supabase session, so AuthContext's own
    // listener resolves `user` too — that must not trigger the normal
    // "already signed in, go to the app" redirect while we're mid-reset.
    mockAuthUser = { id: "recovered-user" };
    rerender(<Login />);

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /update password/i })).toBeInTheDocument();
  });

  it("rejects mismatched password confirmation without calling Supabase", () => {
    render(<Login />);
    act(() => recoveryCallback!("PASSWORD_RECOVERY", {}));

    fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: "newpass123" } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: "different" } });
    fireEvent.click(screen.getByRole("button", { name: /update password/i }));

    expect(supabase.auth.updateUser).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });
});
