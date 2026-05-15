import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createJobFromUrlAction } from "@/app/actions/jobs";

export default async function NewJobPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/sign-in");
  }

  return (
    <main className="min-h-screen bg-white px-6 py-16 dark:bg-neutral-950">
      <div className="mx-auto max-w-xl">
        <Link
          href="/dashboard"
          className="text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
        >
          ← Dashboard
        </Link>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Add a job description</CardTitle>
            <CardDescription>
              Paste a job-posting URL. We&apos;ll scrape it, structure it, and
              let you tailor a resume against it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createJobFromUrlAction} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="url">Job posting URL</Label>
                <Input
                  id="url"
                  name="url"
                  type="url"
                  required
                  placeholder="https://example.com/careers/staff-engineer"
                />
              </div>
              <Button type="submit" className="w-full">
                Scrape job description
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
