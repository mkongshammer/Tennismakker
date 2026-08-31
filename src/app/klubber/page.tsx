import { redirect } from "next/navigation";

// Klublisten hedder nu "Book bane" og ligger på /book.
export default function KlubberPage() {
  redirect("/book");
}
