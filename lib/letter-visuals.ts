import {
  Banknote,
  Briefcase,
  CircleParking,
  FileText,
  HeartPulse,
  Landmark,
  Plane,
  Radio,
  Home,
  type LucideIcon,
} from "lucide-react";
import type { Letter } from "@/types";

/** Picks an icon for a letter from its sender / document type keywords. */
export function letterIcon(letter: Pick<Letter, "sender" | "documentType">): LucideIcon {
  const s = `${letter.sender ?? ""} ${letter.documentType ?? ""}`.toLowerCase();
  if (s.includes("finanzamt") || s.includes("tax")) return Landmark;
  if (s.includes("rundfunk") || s.includes("broadcast")) return Radio;
  if (s.includes("fine") || s.includes("bußgeld") || s.includes("traffic"))
    return CircleParking;
  if (s.includes("kranken") || s.includes("insurance")) return HeartPulse;
  if (s.includes("ausländer") || s.includes("residence") || s.includes("lea"))
    return Plane;
  if (s.includes("jobcenter") || s.includes("document")) return Briefcase;
  if (s.includes("bürgeramt") || s.includes("registration") || s.includes("anmeldung"))
    return Home;
  if (s.includes("bank") || s.includes("payment")) return Banknote;
  return FileText;
}
