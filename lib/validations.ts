import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Ongeldig e-mailadres"),
  password: z.string().min(1, "Wachtwoord is verplicht"),
});

export const vakSchema = z.object({
  naam: z.string().min(2, "Naam moet minimaal 2 tekens bevatten"),
  categorie: z.enum(["HIFZ", "TAJWEED", "ARABISCH", "FIQH", "SIRA", "OVERIG"]),
  beschrijving: z.string().optional(),
});

export const gebruikerSchema = z.object({
  name: z.string().min(2, "Naam moet minimaal 2 tekens bevatten"),
  email: z.string().email("Ongeldig e-mailadres"),
  password: z.string().min(8, "Wachtwoord moet minimaal 8 tekens bevatten").optional(),
  role: z.enum(["ADMIN", "DOCENT", "LEERLING"]),
  actief: z.boolean().default(true),
});

export const klasSchema = z.object({
  naam: z.string().min(2, "Naam moet minimaal 2 tekens bevatten"),
  beschrijving: z.string().optional(),
});

export type Role = "ADMIN" | "DOCENT" | "LEERLING";
export type VakCategorie = "HIFZ" | "TAJWEED" | "ARABISCH" | "FIQH" | "SIRA" | "OVERIG";

export type LoginFormData = z.infer<typeof loginSchema>;
export type VakFormData = z.infer<typeof vakSchema>;
export type GebruikerFormData = z.infer<typeof gebruikerSchema>;
export type KlasFormData = z.infer<typeof klasSchema>;
