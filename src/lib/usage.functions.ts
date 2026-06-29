import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type UsageInfo = {
  plan: "free" | "starter" | "pro" | "agency";
  used: number;
  limit: number;
  remaining: number;
};

export const getMyUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("get_my_usage");
    if (error) throw new Error(error.message);
    return (data as UsageInfo | null) ?? {
      plan: "free" as const,
      used: 0,
      limit: 5,
      remaining: 5,
    };
  });
