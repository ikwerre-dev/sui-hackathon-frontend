"use client";
import { ReactNode, useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import { useRouter } from "next/navigation";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<"seller" | "logistics" | "consumer" | null>(
    null
  );
  const router = useRouter();

  useEffect(() => {
    // Get role from localStorage where your role selection page stores it
    const savedRole = localStorage.getItem("userRole") as
      | "seller"
      | "logistics"
      | "consumer"
      | null;

    if (!savedRole) {
      // Redirect to role selection if no role is set
      router.push("/roleselection");
      return;
    }

    setRole(savedRole);

    // Verify the role matches the current route
    const path = window.location.pathname.split("/");
    const routeRole = path[2]; // /user/[role]/...

    if (routeRole && routeRole !== savedRole) {
      router.push(`/user/${savedRole}/overview`);
    }
  }, [router]);

  if (!role) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row h-screen">
      <Sidebar role={role} />
      <main className="flex-1 overflow-y-auto bg-gray-50 p-6">{children}</main>
    </div>
  );
}
