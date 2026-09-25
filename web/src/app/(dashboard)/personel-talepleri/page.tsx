"use client";

import { RequireRole } from "@/components/RequireRole";
import { StaffRequestsView } from "@/components/StaffRequestsView";

export default function StaffRequestsInboxPage() {
  return (
    <RequireRole roles={["OWNER"]}>
      <StaffRequestsView mode="owner" />
    </RequireRole>
  );
}
