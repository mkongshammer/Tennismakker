import { redirect } from "next/navigation";

// Klublisten hedder nu "Book ink" og ligger på /book.
export default function KlubberPage() {
  redirect("/book");
}
