import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesUpdate } from "@/integrations/supabase/types";

export type Profile = Omit<Tables<"profiles">, "full_name">;
export type ProfileUpdate = Pick<TablesUpdate<"profiles">, "name" | "sdt" | "email">;

export function useProfile(userId: string | null | undefined) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(Boolean(userId));
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from("profiles")
      .select("id, name, role, status, sdt, email, updated_at, created_at, is_active")
      .eq("id", userId)
      .single();

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setProfile(data);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const updateProfile = useCallback(
    async (changes: ProfileUpdate) => {
      if (!userId) return { data: null, error: new Error("User is not authenticated") };

      const { data, error: updateError } = await supabase
        .from("profiles")
        .update(changes)
        .eq("id", userId)
        .select("id, name, role, status, sdt, email, updated_at, created_at, is_active")
        .single();

      if (updateError) {
        setError(updateError.message);
        return { data: null, error: updateError };
      }

      setProfile(data);
      setError(null);
      return { data, error: null };
    },
    [userId],
  );

  return { profile, loading, error, reload: loadProfile, updateProfile };
}