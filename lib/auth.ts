import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { telPogingen, registreerPoging, wisPogingen } from "@/lib/rate-limit";

type Role = "ADMIN" | "DOCENT" | "LEERLING" | "OUDER";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: Role;
      schoolId: string | null;
      isVolwassen: boolean;
    };
  }

  interface User {
    id: string;
    name: string;
    email: string;
    role: Role;
    schoolId: string | null;
    isVolwassen: boolean;
  }
}

// JWT type augmentation via next-auth session module


export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role as Role;
        token.schoolId = user.schoolId ?? null;
        token.isVolwassen = user.isVolwassen ?? false;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
        session.user.schoolId = (token.schoolId as string | null) ?? null;
        session.user.isVolwassen = (token.isVolwassen as boolean) ?? false;
      }
      return session;
    },
  },
  providers: [
    Credentials({
      name: "Inloggen",
      credentials: {
        email: { label: "E-mailadres", type: "email" },
        password: { label: "Wachtwoord", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // Brute-force-bescherming: max 5 mislukte pogingen per e-mail per 15 min
        const emailNorm = String(credentials.email).toLowerCase().trim();
        const emailSleutel = `login-email:${emailNorm}`;
        if ((await telPogingen(emailSleutel, 15)) >= 5) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: emailNorm },
        });

        // Gearchiveerde (soft-deleted) accounts kunnen niet meer inloggen
        if (!user || !user.actief || user.verwijderdOp) {
          await registreerPoging(emailSleutel);
          return null;
        }

        const passwordValid = await compare(
          credentials.password as string,
          user.password
        );

        if (!passwordValid) {
          await registreerPoging(emailSleutel);
          return null;
        }

        await wisPogingen(emailSleutel);

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role as Role,
          schoolId: user.schoolId ?? null,
          isVolwassen: user.isVolwassen ?? false,
        };
      },
    }),
  ],
});
