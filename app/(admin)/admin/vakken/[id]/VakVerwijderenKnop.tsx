"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Props {
  vakId: string;
  vakNaam: string;
  heeftKlassen: boolean;
}

export default function VakVerwijderenKnop({ vakId, vakNaam, heeftKlassen }: Props) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleDelete = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/vakken/${vakId}`, { method: "DELETE" });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? "Verwijderen mislukt");
      } else {
        toast.success("Vak verwijderd");
        router.push("/admin/vakken");
        router.refresh();
      }
    } catch {
      toast.error("Fout bij verwijderen");
    } finally {
      setIsLoading(false);
    }
  };

  if (heeftKlassen) {
    return (
      <Button variant="destructive" disabled className="cursor-not-allowed">
        <Trash2 className="h-4 w-4" />
        Vak verwijderen (gekoppeld aan klassen)
      </Button>
    );
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" disabled={isLoading}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          Vak verwijderen
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Vak permanent verwijderen?</AlertDialogTitle>
          <AlertDialogDescription>
            Weet u zeker dat u <strong>{vakNaam}</strong> wilt verwijderen?
            Deze actie kan niet ongedaan worden gemaakt.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuleren</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-red-600 hover:bg-red-700"
          >
            Ja, verwijderen
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
