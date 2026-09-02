import "server-only";

import { notFound } from "next/navigation";
import { isEvalAdminEmail } from "@/lib/auth/access";
import { requireUser } from "@/lib/auth/user";

export async function requireEvalAdmin() {
  const user = await requireUser();
  if (!isEvalAdminEmail(user.email)) notFound();
  return user;
}
