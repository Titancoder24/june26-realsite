"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { CalendarCheck, Loader2, X } from "lucide-react";
import { toast } from "sonner";

export function WalkthroughSiteVisitWidget({
  propertyId,
  sessionId,
  propertyName,
}: {
  propertyId: string;
  sessionId?: string | null;
  propertyName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    date: "",
    time: "",
    notes: "",
  });

  async function submit() {
    if (!form.name.trim() || !form.phone.trim() || !form.date || !form.time) {
      toast.error("Please enter name, phone, date, and time.");
      return;
    }

    const scheduledAt = new Date(`${form.date}T${form.time}`).toISOString();
    if (Number.isNaN(new Date(scheduledAt).getTime())) {
      toast.error("Invalid date or time.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/site-visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId,
          sessionId: sessionId ?? undefined,
          scheduledAt,
          visitorName: form.name.trim(),
          visitorPhone: form.phone.trim(),
          visitorEmail: form.email.trim() || undefined,
          visitType: "in_person",
          notes: form.notes.trim()
            ? `${form.notes.trim()} · Source: walkthrough_preview_widget`
            : "Source: walkthrough_preview_widget",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Booking failed");

      setSubmitted(true);
      toast.success("Site visit request submitted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not book site visit");
    } finally {
      setSubmitting(false);
    }
  }

  function resetAndClose() {
    setOpen(false);
    setTimeout(() => {
      setSubmitted(false);
      setForm({ name: "", phone: "", email: "", date: "", time: "", notes: "" });
    }, 300);
  }

  return (
    <>
      <div className="wt-site-visit-fab">
        <Button
          type="button"
          className="wt-site-visit-fab-btn"
          onClick={() => setOpen(true)}
          aria-label="Book site visit"
        >
          <CalendarCheck className="mr-2 h-4 w-4" />
          Book Site Visit
        </Button>
      </div>

      <Sheet open={open} onOpenChange={(next) => (next ? setOpen(true) : resetAndClose())}>
        <SheetContent side="bottom" className="wt-site-visit-sheet max-h-[85dvh] rounded-t-2xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:bottom-6 md:right-6 md:left-auto md:max-w-sm md:rounded-xl md:border md:shadow-xl">
          <SheetHeader className="text-left">
            <div className="flex items-start justify-between gap-2">
              <div>
                <SheetTitle>Book a site visit</SheetTitle>
                <SheetDescription>
                  {propertyName ? `Schedule your visit to ${propertyName}.` : "Pick a date and time — our team will confirm."}
                </SheetDescription>
              </div>
              <Button type="button" size="icon" variant="ghost" className="shrink-0" onClick={resetAndClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </SheetHeader>

          {submitted ? (
            <div className="mt-6 space-y-3 text-center">
              <CalendarCheck className="mx-auto h-10 w-10 text-emerald-500" />
              <p className="font-medium">Visit request received</p>
              <p className="text-sm text-muted-foreground">
                Our sales team will confirm your appointment shortly.
              </p>
              <Button className="w-full" onClick={resetAndClose}>Close</Button>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 sm:col-span-1">
                  <Label htmlFor="visit-date">Date</Label>
                  <Input
                    id="visit-date"
                    type="date"
                    className="mt-1 min-h-[44px] text-base"
                    value={form.date}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <Label htmlFor="visit-time">Time</Label>
                  <Input
                    id="visit-time"
                    type="time"
                    className="mt-1 min-h-[44px] text-base"
                    value={form.time}
                    onChange={(e) => setForm({ ...form, time: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="visit-name">Name</Label>
                <Input
                  id="visit-name"
                  className="mt-1 min-h-[44px]"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="visit-phone">Phone</Label>
                <Input
                  id="visit-phone"
                  type="tel"
                  inputMode="tel"
                  className="mt-1 min-h-[44px]"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="visit-email">Email (optional)</Label>
                <Input
                  id="visit-email"
                  type="email"
                  className="mt-1 min-h-[44px]"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="visit-notes">Notes (optional)</Label>
                <Input
                  id="visit-notes"
                  className="mt-1 min-h-[44px]"
                  placeholder="Preferred tower, unit type…"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
              <Button className="w-full min-h-[48px]" onClick={submit} disabled={submitting}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarCheck className="mr-2 h-4 w-4" />}
                Request visit
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
