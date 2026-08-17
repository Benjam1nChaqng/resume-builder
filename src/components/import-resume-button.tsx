"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { createResumeFromImportAction } from "@/app/actions/resumes";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Parsing with GPT..." : label}
    </Button>
  );
}

export function ImportResumeButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>Import resume</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Import a resume</DialogTitle>
            <DialogDescription>
              Upload a PDF or paste text. GPT extracts the structured fields.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="pdf">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="pdf">Upload PDF</TabsTrigger>
              <TabsTrigger value="text">Paste text</TabsTrigger>
            </TabsList>

            <TabsContent value="pdf" className="mt-4">
              <form action={createResumeFromImportAction} className="space-y-4">
                <input type="hidden" name="mode" value="pdf" />
                <div className="space-y-2">
                  <Label htmlFor="pdf-input">Resume PDF</Label>
                  <Input
                    id="pdf-input"
                    type="file"
                    name="pdf"
                    accept="application/pdf"
                    required
                  />
                </div>
                <SubmitButton label="Upload & parse" />
              </form>
            </TabsContent>

            <TabsContent value="text" className="mt-4">
              <form action={createResumeFromImportAction} className="space-y-4">
                <input type="hidden" name="mode" value="text" />
                <div className="space-y-2">
                  <Label htmlFor="text-input">Resume text</Label>
                  <Textarea
                    id="text-input"
                    name="text"
                    rows={12}
                    required
                    placeholder="Paste your resume text here…"
                  />
                </div>
                <SubmitButton label="Parse text" />
              </form>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}
