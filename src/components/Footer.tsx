import Link from "next/link";
import { getCurrentPlayer } from "@/lib/session";

export default async function Footer() {
  const player = await getCurrentPlayer();
  if (!player?.isCommissioner) return null;

  return (
    <footer className="border-t border-gray-200 py-4 text-center">
      <Link href="/admin" className="text-xs text-gray-300 hover:text-purple-700">
        Admin
      </Link>
    </footer>
  );
}
