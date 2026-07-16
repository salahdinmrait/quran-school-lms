import { NextResponse } from "next/server";
import { isDevAuthenticated } from "@/lib/dev-auth";
import ExcelJS from "exceljs";

// GET /api/dev/import-template — download de Excel-template die scholen
// invullen om al hun gebruikers aan te leveren.
export async function GET() {
  if (!(await isDevAuthenticated())) {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Jadwal";

  // ── Blad 1: in te vullen gebruikerslijst ──────────────────────────────────
  const sheet = workbook.addWorksheet("Gebruikers");
  sheet.columns = [
    { header: "Voornaam", key: "voornaam", width: 18 },
    { header: "Achternaam", key: "achternaam", width: 22 },
    { header: "E-mailadres", key: "email", width: 32 },
    { header: "Telefoonnummer", key: "telefoon", width: 18 },
    { header: "Rol", key: "rol", width: 14 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFDCFCE7" },
  };

  // Voorbeeldrij (mag verwijderd/overschreven worden)
  sheet.addRow(["Ahmed", "El Amrani", "ahmed@voorbeeld.nl", "0612345678", "LEERLING"]);

  // Dropdown-validatie op de Rol-kolom voor de eerste 1000 rijen
  for (let rij = 2; rij <= 1001; rij++) {
    sheet.getCell(`E${rij}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ['"LEERLING,OUDER,DOCENT,ADMIN"'],
      showErrorMessage: true,
      errorTitle: "Ongeldige rol",
      error: "Kies: LEERLING, OUDER, DOCENT of ADMIN",
    };
  }

  // ── Blad 2: instructies ───────────────────────────────────────────────────
  const info = workbook.addWorksheet("Instructies");
  info.columns = [{ width: 100 }];
  const regels = [
    "Jadwal — Gebruikers importeren",
    "",
    "Vul op het blad 'Gebruikers' één rij per persoon in:",
    "  • Voornaam en Achternaam — verplicht",
    "  • E-mailadres — verplicht en uniek; hierop ontvangt de persoon de inloggegevens",
    "  • Telefoonnummer — optioneel",
    "  • Rol — verplicht: LEERLING, OUDER, DOCENT of ADMIN",
    "",
    "Wat gebeurt er na het aanleveren?",
    "  • Voor iedere rij wordt een Jadwal-account aangemaakt met een tijdelijk wachtwoord.",
    "  • Iedereen ontvangt automatisch een e-mail met de inloggegevens en een link om",
    "    een eigen wachtwoord te kiezen (7 dagen geldig).",
    "",
    "Let op:",
    "  • De voorbeeldrij mag u verwijderen of overschrijven.",
    "  • Bestaat een e-mailadres al in Jadwal, dan wordt die rij overgeslagen.",
    "  • Ouders en leerlingen worden nog niet automatisch gekoppeld; de schooladmin",
    "    koppelt ouders aan hun kind in het beheerscherm.",
  ];
  regels.forEach((r, i) => {
    const cell = info.getCell(`A${i + 1}`);
    cell.value = r;
    if (i === 0) cell.font = { bold: true, size: 14 };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="Jadwal-import-template.xlsx"',
    },
  });
}
