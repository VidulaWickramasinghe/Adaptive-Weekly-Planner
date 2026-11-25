import { z } from "zod";
export const settingsSchema = z.object({
  timezone: z
    .string()
    .trim()
    .min(1)
    .refine((zone) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: zone });
        return !/^[+-]/.test(zone);
      } catch {
        return false;
      }
    }, "Enter a valid time zone, such as Australia/Melbourne."),
  preferred_daily_capacity: z.coerce.number().int().min(0).max(1440),
  version: z.coerce.number().int().nonnegative(),
});
export type Profile = z.infer<typeof settingsSchema> & {
  user_id: string;
  week_start_day: number;
};
