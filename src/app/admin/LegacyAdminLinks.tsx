"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
export function LegacyAdminLinks() {
  const router = useRouter();
  useEffect(() => {
    const target = ({ '#sportsgrene': '/admin/baner', '#lys-og-adgang': '/admin/lys-adgang' } as Record<string,string>)[window.location.hash];
    if (target) router.replace(target);
  }, [router]);
  return null;
}
