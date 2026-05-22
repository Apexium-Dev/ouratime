"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

export function OnlineHeartbeat() {
  useEffect(() => {
    const ping = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase
        .from("profiles")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", user.id);
    };

    ping();
    const id = setInterval(ping, 2 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  return null;
}
