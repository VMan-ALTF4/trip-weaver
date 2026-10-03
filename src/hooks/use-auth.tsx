import type { Session, User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";

export type OAuthProvider = "google";

export type Profile = {
  id: string;
  name: string | null;
  role: "admin" | "moderator" | "guest";
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

  useEffect(() => {
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

      async updateProfile(name, sdt) {
        if (!user) return { error: "User is not authenticated" };

        const { data, error } = await supabase
          .from("profiles")
          .update({ name: name.trim(), full_name: name.trim(), sdt: sdt.trim() || null })
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

        const { error } = await supabase.auth.updateUser(
          { email: email.trim() },
          { emailRedirectTo: `${window.location.origin}/` },
        );
        return { error: error?.message ?? null };
      },

      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return { error: error?.message ?? null };
      },

      async signUp(fullName, email, password) {
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
        const { error } = await supabase.auth.signInWithOAuth({
          provider,
          options: { redirectTo: window.location.origin },
        });
        return { error: error?.message ?? null };
      },

      async resetPassword(email) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        return { error: error?.message ?? null };
      },

      async signOut() {
        await supabase.auth.signOut();
        setProfile(null);
      },
    };
  }, [user, session, profile, loading, profileLoading, profileLoadedFor]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
