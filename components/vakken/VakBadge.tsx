import { cn } from "@/lib/utils";

type VakCategorie = "HIFZ" | "TAJWEED" | "ARABISCH" | "FIQH" | "SIRA" | "OVERIG";

const categorieLabels: Record<VakCategorie, string> = {
  HIFZ: "Hifz",
  TAJWEED: "Tajweed",
  ARABISCH: "Arabisch",
  FIQH: "Fiqh",
  SIRA: "Sira",
  OVERIG: "Overig",
};

const categorieColors: Record<VakCategorie, string> = {
  HIFZ: "bg-emerald-100 text-emerald-800",
  TAJWEED: "bg-blue-100 text-blue-800",
  ARABISCH: "bg-amber-100 text-amber-800",
  FIQH: "bg-purple-100 text-purple-800",
  SIRA: "bg-rose-100 text-rose-800",
  OVERIG: "bg-gray-100 text-gray-700",
};

interface VakBadgeProps {
  categorie: VakCategorie;
  className?: string;
}

export function VakBadge({ categorie, className }: VakBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        categorieColors[categorie],
        className
      )}
    >
      {categorieLabels[categorie]}
    </span>
  );
}
