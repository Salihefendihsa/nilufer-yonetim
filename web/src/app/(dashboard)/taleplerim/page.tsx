"use client";

import { RequireRole } from "@/components/RequireRole";
import { StaffRequestsView } from "@/components/StaffRequestsView";

export default function MyStaffRequestsPage() {
  return (
    <RequireRole roles={["MANAGER", "TEAM_LEAD", "STAFF"]}>
      <StaffRequestsView mode="mine" />
    </RequireRole>
  );
}
