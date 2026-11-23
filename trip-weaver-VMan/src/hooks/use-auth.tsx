import type { Session, User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import { normalizePhoneToE164 } from "@/lib/booking-profile";

export type OAuthProvider = "google";

export type Profile = {
  id: string;
  name: string | null;
  role: string;
  sdt: string | null;
  email: string | null;
};

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  profileLoading: boolean;
  displayName: string;
  profileEditorOpen: boolean;
  profileEditorRequiresPhone: boolean;
  openProfileEditor: (options?: { requirePhone?: boolean }) => void;
  closeProfileEditor: () => void;
  refreshAuthProfile: () => Promise<{ user: User; profile: Profile | null }>;
  updateProfile: (name: string, sdt: string) => Promise<{ error: string | null }>;
  requestEmailChange: (email: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (
    fullName: string,
    email: string,
    password: string,
  ) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  signInWithProvider: (provider: OAuthProvider) => Promise<{ error: string | null }>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileLoadedFor, setProfileLoadedFor] = useState<string | null>(null);
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const [profileEditorRequiresPhone, setProfileEditorRequiresPhone] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      setProfileLoading(false);
      return;
    }

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setProfileLoadedFor(null);
      setProfileLoading(false);
      return;
    }
    let active = true;
    setProfileLoading(true);
    supabase
      .from("profiles")
      .select("id, name, role, sdt, email")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (active) {
          setProfile((data as Profile | null) ?? null);
          setProfileLoadedFor(user.id);
          setProfileLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let active = true;
    let refreshing = false;

    const refreshUserOnReturn = () => {
      if (document.visibilityState !== "visible" || refreshing) return;
      refreshing = true;
      void supabase.auth
        .refreshSession()
        .then(({ data, error }) => {
          if (!active) return;
          if (error) {
            console.error("Unable to refresh the auth session after returning to the app.", error);
            return;
          }
          if (data.session) {
            setSession(data.session);
            setUser(data.session.user);
          }
        })
        .catch((error: unknown) => {
          if (active) {
            console.error("Unable to refresh the auth session after returning to the app.", error);
          }
        })
        .finally(() => {
          refreshing = false;
        });
    };

    window.addEventListener("focus", refreshUserOnReturn);
    document.addEventListener("visibilitychange", refreshUserOnReturn);
    return () => {
      active = false;
      window.removeEventListener("focus", refreshUserOnReturn);
      document.removeEventListener("visibilitychange", refreshUserOnReturn);
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const metaName =
      (user?.user_metadata?.["full_name"] as string | undefined) ??
      (user?.user_metadata?.["name"] as string | undefined) ??
      null;

    return {
      user,
      session,
      profile,
      loading,
      profileLoading: profileLoading || Boolean(user && profileLoadedFor !== user.id),
      displayName: profile?.name ?? metaName ?? user?.email?.split("@")[0] ?? "Traveller",
      profileEditorOpen,
      profileEditorRequiresPhone,

      openProfileEditor(options) {
        setProfileEditorRequiresPhone(Boolean(options?.requirePhone));
        setProfileEditorOpen(true);
      },

      closeProfileEditor() {
        setProfileEditorOpen(false);
        setProfileEditorRequiresPhone(false);
      },

      async refreshAuthProfile() {
        if (!isSupabaseConfigured()) throw new Error("Supabase is not configured.");
        const {
          data: { session: refreshedSession },
          error: sessionError,
        } = await supabase.auth.refreshSession();
        if (sessionError) throw sessionError;
        if (!refreshedSession) throw new Error("User is not authenticated.");
        const refreshedUser = refreshedSession.user;

        const { data, error: profileError } = await supabase
          .from("profiles")
          .select("id, name, role, sdt, email")
          .eq("id", refreshedUser.id)
          .maybeSingle();
        if (profileError) throw profileError;

        const refreshedProfile = (data as Profile | null) ?? null;
        setSession(refreshedSession);
        setUser(refreshedUser);
        setProfile(refreshedProfile);
        setProfileLoadedFor(refreshedUser.id);
        setProfileLoading(false);
        return { user: refreshedUser, profile: refreshedProfile };
      },

      async updateProfile(name, sdt) {
        if (!user) return { error: "User is not authenticated" };
        if (!isSupabaseConfigured()) return { error: "Supabase is not configured." };
        const trimmedPhone = sdt.trim();
        const normalizedPhone = trimmedPhone ? normalizePhoneToE164(trimmedPhone) : null;
        if (trimmedPhone && !normalizedPhone) {
          return { error: "Please enter a valid phone number." };
        }

        const { data, error } = await supabase
          .from("profiles")
          .update({ name: name.trim(), sdt: normalizedPhone })
          .eq("id", user.id)
          .select("id, name, role, sdt, email")
          .single();

        if (error) return { error: error.message };
        setProfile(data as Profile);
        setProfileLoadedFor(user.id);
        return { error: null };
      },

      async requestEmailChange(email) {
        if (!user) return { error: "User is not authenticated" };
        if (!isSupabaseConfigured()) return { error: "Supabase is not configured." };

        const { data, error } = await supabase.auth.updateUser(
          { email: email.trim() },
          { emailRedirectTo: window.location.href },
        );
        if (!error) setUser(data.user);
        return { error: error?.message ?? null };
      },

      async signIn(email, password) {
        if (!isSupabaseConfigured()) return { error: "Supabase is not configured." };
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return { error: error?.message ?? null };
      },

      async signUp(fullName, email, password) {
        if (!isSupabaseConfigured()) {
          return { error: "Supabase is not configured.", needsConfirmation: false };
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { name: fullName, full_name: fullName },
          },
        });
        return {
          error: error?.message ?? null,
          needsConfirmation: !error && !data.session,
        };
      },

      async signInWithProvider(provider) {
        if (!isSupabaseConfigured()) return { error: "Supabase is not configured." };
        const { error } = await supabase.auth.signInWithOAuth({
          provider,
          options: { redirectTo: window.location.origin },
        });
        return { error: error?.message ?? null };
      },

      async resetPassword(email) {
        if (!isSupabaseConfigured()) return { error: "Supabase is not configured." };
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        return { error: error?.message ?? null };
      },

      async signOut() {
        if (isSupabaseConfigured()) await supabase.auth.signOut();
        setProfile(null);
      },
    };
  }, [
    user,
    session,
    profile,
    loading,
    profileLoading,
    profileLoadedFor,
    profileEditorOpen,
    profileEditorRequiresPhone,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
