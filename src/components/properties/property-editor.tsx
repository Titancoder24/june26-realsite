"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

export function PropertyEditor({ propertyId }: { propertyId: string }) {
  const [form, setForm] = useState({
    name: "", unit_type: "", configuration: "", tower: "", floor: "", facing: "",
    area: "", price_min: "", price_max: "", availability: "available", furnishing_status: "", publish_status: "draft",
  });

  useEffect(() => {
    fetch(`/api/properties/${propertyId}`).then((r) => r.json()).then((d) => {
      setForm({
        name: d.name ?? "", unit_type: d.unit_type ?? "", configuration: d.configuration ?? "",
        tower: d.tower ?? "", floor: d.floor ?? "", facing: d.facing ?? "",
        area: d.area?.toString() ?? "", price_min: d.price_min?.toString() ?? "", price_max: d.price_max?.toString() ?? "",
        availability: d.availability ?? "available", furnishing_status: d.furnishing_status ?? "", publish_status: d.publish_status ?? "draft",
      });
    });
  }, [propertyId]);

  async function save() {
    const res = await fetch(`/api/properties/${propertyId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        area: form.area ? Number(form.area) : undefined,
        price_min: form.price_min ? Number(form.price_min) : undefined,
        price_max: form.price_max ? Number(form.price_max) : undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) return toast.error(data.error);
    toast.success("Property saved");
  }

  const field = (key: keyof typeof form, label: string, type = "text") => (
    <div>
      <label className="mb-1 block text-sm text-muted-foreground">{label}</label>
      <Input type={type} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between">
        <h1 className="section-title">Property Editor</h1>
        <Button onClick={save}>Save</Button>
      </div>
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="pricing">Pricing</TabsTrigger>
          <TabsTrigger value="compliance">Details</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <Card><CardHeader><CardTitle>Overview</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              {field("name", "Property name")}
              {field("unit_type", "Unit type")}
              {field("configuration", "Configuration")}
              {field("tower", "Tower")}
              {field("floor", "Floor")}
              {field("facing", "Facing")}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="pricing">
          <Card><CardContent className="grid gap-4 pt-6 md:grid-cols-2">
            {field("area", "Area (sq ft)", "number")}
            {field("price_min", "Price min", "number")}
            {field("price_max", "Price max", "number")}
            {field("availability", "Availability")}
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="compliance">
          <Card><CardContent className="grid gap-4 pt-6 md:grid-cols-2">
            {field("furnishing_status", "Furnishing")}
            {field("publish_status", "Publish status")}
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
