"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GraduationCap, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { loginSchema, type LoginFormData } from "@/lib/validations";

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (result?.error) {
        toast.error("Inloggen mislukt. Controleer uw e-mailadres en wachtwoord.");
      } else {
        // Fetch session to get role and redirect
        const res = await fetch("/api/auth/session");
        const session = await res.json();
        const role = session?.user?.role;

        if (role === "ADMIN") router.push("/admin");
        else if (role === "DOCENT") router.push("/docent");
        else if (role === "LEERLING") router.push("/leerling");
        else if (role === "OUDER") router.push("/ouder");
        else router.push("/login");
      }
    } catch {
      toast.error("Er is een fout opgetreden. Probeer het opnieuw.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-green-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-700 mb-4">
            <GraduationCap className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-green-800">Quran School LMS</h1>
          <p className="text-gray-500 mt-1 text-sm">Leerling Management Systeem</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Inloggen</CardTitle>
            <CardDescription>
              Voer uw e-mailadres en wachtwoord in om toegang te krijgen.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mailadres</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="naam@school.nl"
                  autoComplete="email"
                  {...register("email")}
                />
                {errors.email && (
                  <p className="text-xs text-red-600">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Wachtwoord</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-red-600">{errors.password.message}</p>
                )}
              </div>

              <div className="flex justify-end">
                <Link href="/login/wachtwoord-vergeten" className="text-xs text-green-700 hover:underline">
                  Wachtwoord vergeten?
                </Link>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Inloggen...
                  </>
                ) : (
                  "Inloggen"
                )}
              </Button>
            </form>

            {/* Test credentials */}
            <div className="mt-6 p-3 bg-green-50 rounded-md border border-green-200">
              <p className="text-xs font-medium text-green-700 mb-2">Testaccounts:</p>
              <div className="space-y-1 text-xs text-green-600">
                <p><span className="font-medium">Admin:</span> admin@school.nl / Admin123!</p>
                <p><span className="font-medium">Docent:</span> docent@school.nl / Docent123!</p>
                <p><span className="font-medium">Leerling:</span> leerling@school.nl / Leerling123!</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
