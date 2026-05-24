import { redirect } from "next/navigation";

/** Khong dung form user/pass — local mac dinh vao thang dashboard. */
export default function LoginPage() {
  redirect("/dashboard");
}
