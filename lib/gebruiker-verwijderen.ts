import { prisma } from "@/lib/prisma";

/**
 * Eén account definitief uit de database halen, inclusief alles wat eraan hangt.
 *
 * ONOMKEERBAAR — dit is geen soft delete. Er blijft niets van deze persoon over:
 * cijfers, aanwezigheid, berichten en dossiernotities gaan mee.
 *
 * De volgorde respecteert de foreign keys. Twee dingen zijn niet vanzelfsprekend:
 * berichten verwijzen via `replyToId` naar zichzelf, dus die verwijzing wordt
 * eerst losgeknipt; `HifdhTaak` hangt met onDelete: Cascade aan het profiel en
 * verdwijnt daarom vanzelf.
 *
 * De aanroeper bepaalt óf het mag (school, archiefstatus, bevestiging). Deze
 * functie controleert dat niet — ze voert alleen uit.
 */
export async function verwijderGebruikerDefinitief(id: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.bericht.updateMany({
      where: { replyTo: { OR: [{ verzenderId: id }, { ontvangerId: id }] } },
      data: { replyToId: null },
    });
    await tx.bericht.deleteMany({ where: { OR: [{ verzenderId: id }, { ontvangerId: id }] } });
    await tx.aanwezigheid.deleteMany({ where: { leerlingId: id } });
    await tx.cijfer.deleteMany({ where: { leerlingId: id } });
    await tx.inlevering.deleteMany({ where: { leerlingId: id } });
    await tx.huiswerkLeerling.deleteMany({ where: { leerlingId: id } });
    await tx.leerlingDossier.deleteMany({ where: { OR: [{ leerlingId: id }, { auteurId: id }] } });
    await tx.studieMateriaal.deleteMany({ where: { docentId: id } });
    await tx.hifdhProfiel.deleteMany({ where: { leerlingId: id } });
    await tx.ouderLeerling.deleteMany({ where: { OR: [{ ouderId: id }, { leerlingId: id }] } });
    await tx.passwordResetToken.deleteMany({ where: { gebruikerId: id } });
    await tx.klasDocent.deleteMany({ where: { docentId: id } });
    await tx.klasLeerling.deleteMany({ where: { leerlingId: id } });
    await tx.user.delete({ where: { id } });
  });
}
