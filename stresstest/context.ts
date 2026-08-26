import type { Fixture } from "./fixture";
import { WACHTWOORD } from "./fixture";
import { login, devCookie, type Sessie } from "./lib";

/** Alles wat een suite nodig heeft: de fixture plus een ingelogde sessie per rol. */
export interface Ctx {
  f: Fixture;
  adminA: Sessie;
  adminB: Sessie;
  docentA1: Sessie;
  docentA2: Sessie;
  docentB1: Sessie;
  leerlingA1: Sessie;
  leerlingA2: Sessie;
  leerlingA4: Sessie;
  leerlingB1: Sessie;
  ouderA1: Sessie;
  ouderA3: Sessie;
  /** dev-console-cookie; null als DEVELOPER_SECRET niet klopt */
  dev: string | null;
}

export type Suite = (c: Ctx) => Promise<void>;

export async function bouwContext(f: Fixture): Promise<Ctx> {
  async function inloggen(email: string): Promise<Sessie> {
    const s = await login(email, WACHTWOORD);
    if (!s) throw new Error(`Kon niet inloggen als ${email} — is de dev-server bereikbaar?`);
    return s;
  }

  // Serieel: parallel inloggen laat de rate-limiter per IP (20/15min) aanslaan.
  const adminA = await inloggen(f.adminA.email);
  const adminB = await inloggen(f.adminB.email);
  const docentA1 = await inloggen(f.docentA1.email);
  const docentA2 = await inloggen(f.docentA2.email);
  const docentB1 = await inloggen(f.docentB1.email);
  const leerlingA1 = await inloggen(f.leerlingA1.email);
  const leerlingA2 = await inloggen(f.leerlingA2.email);
  const leerlingA4 = await inloggen(f.leerlingA4.email);
  const leerlingB1 = await inloggen(f.leerlingB1.email);
  const ouderA1 = await inloggen(f.ouderA1.email);
  const ouderA3 = await inloggen(f.ouderA3.email);

  const dev = await devCookie(process.env.DEVELOPER_SECRET ?? "");

  return {
    f, adminA, adminB, docentA1, docentA2, docentB1,
    leerlingA1, leerlingA2, leerlingA4, leerlingB1,
    ouderA1, ouderA3, dev,
  };
}
