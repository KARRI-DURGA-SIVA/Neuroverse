import { useEffect } from "react";
import { useRouter } from "next/router";
import { apiFetch } from "../lib/api-client";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    apiFetch("/api/auth/me")
      .then(() => router.replace("/dashboard"))
      .catch(() => router.replace("/login"));
  }, [router]);

  return null;
}
