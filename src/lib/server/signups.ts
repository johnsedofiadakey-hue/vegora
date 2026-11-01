import "server-only";

import { createHash } from "node:crypto";
import { mergeInterests, type Signup, type SignupInterest } from "../signup.ts";
import { storeDb } from "./firebase-admin";
import { HttpError } from "./http";

const signups = () => storeDb().collection("signups");

/** One document per person: the same address signing up again updates their entry. */
export function signupId(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 32);
}

export interface StoredSignup extends Signup {
  id: string;
  createdAt: string;
  updatedAt: string;
  /** How many times this person has submitted the form. */
  count: number;
}

export async function saveSignup(signup: Signup): Promise<void> {
  const ref = signups().doc(signupId(signup.email));
  const now = new Date().toISOString();
  await storeDb().runTransaction(async (tx) => {
    const previous = (await tx.get(ref)).data() as Partial<StoredSignup> | undefined;
    tx.set(ref, {
      email: signup.email,
      // A later sign-up adds interests and fills gaps; it never erases what we already know.
      name: signup.name || previous?.name || "",
      phone: signup.phone || previous?.phone || "",
      interests: mergeInterests(previous?.interests ?? [], signup.interests),
      message: signup.message || previous?.message || "",
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
      count: (previous?.count ?? 0) + 1,
      source: "footer",
    });
  });
}

export async function listSignups(): Promise<{ signups: StoredSignup[]; truncated: boolean }> {
  const snap = await signups().orderBy("updatedAt", "desc").limit(501).get();
  const items = snap.docs.slice(0, 500).map((doc) => {
    const data = doc.data();
    return {
      id: doc.id, email: String(data.email ?? ""), name: String(data.name ?? ""), phone: String(data.phone ?? ""),
      interests: mergeInterests(Array.isArray(data.interests) ? data.interests.map(String) : []) as SignupInterest[],
      message: String(data.message ?? ""), createdAt: String(data.createdAt ?? ""), updatedAt: String(data.updatedAt ?? ""),
      count: Number(data.count ?? 1),
    };
  });
  return { signups: items, truncated: snap.size > 500 };
}

export async function deleteSignup(id: string): Promise<void> {
  if (!/^[0-9a-f]{32}$/.test(id)) throw new HttpError(404, "Sign-up not found");
  await signups().doc(id).delete();
}
