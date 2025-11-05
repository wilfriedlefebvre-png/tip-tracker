"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Edit, Save, X, Calendar, FileDown, Upload, BarChart2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, CartesianGrid } from "recharts";

// Types
interface TipEntry {
  id: string;
  date: string; // YYYY-MM-DD
  made: number; // gross tips you made
  tipOut: number; // how much you tipped out
  restaurant?: string; // restaurant name
  notes?: string;
}

// Helpers
const LS_KEY = "tipEntries.v1";

function loadEntries(): TipEntry[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TipEntry[];
    return parsed.map((e) => ({ ...e, made: Number(e.made) || 0, tipOut: Number(e.tipOut) || 0 }));
  } catch {
    return [];
  }
}

function saveEntries(entries: TipEntry[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(entries));
}

function formatUSD(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function monthStart(dateStr?: string) {
  const d = dateStr ? new Date(dateStr) : new Date();
  const y = d.getFullYear();
  const m = d.getMonth();
  return new Date(y, m, 1).toISOString().slice(0, 10);
}

function monthEnd(dateStr?: string) {
  const d = dateStr ? new Date(dateStr) : new Date();
  const y = d.getFullYear();
  const m = d.getMonth();
  return new Date(y, m + 1, 0).toISOString().slice(0, 10);
}

function withinRange(date: string, start?: string, end?: string) {
  if (start && date < start) return false;
  if (end && date > end) return false;
  return true;
}

// CSV helpers
function toCSV(entries: TipEntry[]) {
  const header = ["date", "made", "tipOut", "restaurant", "notes"];
  const rows = entries.map((e) => [e.date, e.made, e.tipOut, (e.restaurant ?? ""), (e.notes ?? "").replaceAll("\n", " ")]);
  const csv = [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
  return csv;
}

function fromCSV(csv: string): TipEntry[] {
  const lines = csv.trim().split(/\r?\n/);
  const header = lines.shift()?.split(",").map((s) => s.trim().toLowerCase()) ?? [];
  const idx = {
    date: header.indexOf("date"),
    made: header.indexOf("made"),
    tipOut: header.indexOf("tipout"),
    restaurant: header.indexOf("restaurant"),
    notes: header.indexOf("notes"),
  };
  const out: TipEntry[] = [];
  for (const line of lines) {
    const cols = line.split(",");
    const date = cols[idx.date]?.trim();
    if (!date) continue;
    const made = Number(cols[idx.made] ?? 0) || 0;
    const tipOut = Number(cols[idx.tipOut] ?? 0) || 0;
    const restaurant = cols[idx.restaurant]?.trim() || "";
    const notes = cols[idx.notes]?.trim() || "";
    out.push({ id: uid(), date, made, tipOut, restaurant: restaurant || undefined, notes });
  }
  return out;
}

// Components
function AddEntryForm({ onAdd }: { onAdd: (e: TipEntry) => void }) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [made, setMade] = useState(0);
  const [tipOut, setTipOut] = useState(0);
  const [restaurant, setRestaurant] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <Card className="shadow-sm">
      <CardContent className="p-4 grid gap-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 items-end">
          <div>
            <Label className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Date
            </Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label>Restaurant</Label>
            <Input
              value={restaurant}
              onChange={(e) => setRestaurant(e.target.value)}
              placeholder="Restaurant name"
            />
          </div>
          <div>
            <Label>Made (Gross)</Label>
            <Input
              type="number"
              inputMode="decimal"
              placeholder="0.00"
              value={made}
              onChange={(e) => setMade(Number(e.target.value))}
            />
          </div>
          <div>
            <Label>Tip Out</Label>
            <Input
              type="number"
              inputMode="decimal"
              placeholder="0.00"
              value={tipOut}
              onChange={(e) => setTipOut(Number(e.target.value))}
            />
          </div>
          <div className="flex gap-2">
            <Button
              className="mt-6 w-full"
              onClick={() => {
                if (!date) return;
                onAdd({ id: uid(), date, made, tipOut, restaurant: restaurant || undefined, notes });
                setMade(0);
                setTipOut(0);
                setRestaurant("");
                setNotes("");
              }}
            >
              <Plus className="w-4 h-4 mr-2" /> Add Shift
            </Button>
          </div>
        </div>
        <div>
          <Label>Notes (optional)</Label>
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Servered patio, big party, etc."
          />
        </div>
      </CardContent>
    </Card>
  );
}

function EntriesTable({ entries, onChange }: { entries: TipEntry[]; onChange: (entries: TipEntry[]) => void }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<TipEntry | null>(null);
  const [sortBy, setSortBy] = useState<keyof TipEntry | "net">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const rows = useMemo(() => {
    const r = [...entries].map((e) => ({ ...e, net: e.made - e.tipOut }));
    r.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      const av = sortBy === "net" ? a.net : (a as any)[sortBy];
      const bv = sortBy === "net" ? b.net : (b as any)[sortBy];
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return r;
  }, [entries, sortBy, sortDir]);

  function setSort(key: keyof TipEntry | "net") {
    if (sortBy === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(key);
      setSortDir(key === "date" ? "desc" : "asc");
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b">
            {[
              { k: "date", label: "Date" },
              { k: "restaurant", label: "Restaurant" },
              { k: "made", label: "Made" },
              { k: "tipOut", label: "Tip Out" },
              { k: "net", label: "Net" },
              { k: "notes", label: "Notes" },
            ].map((col) => (
              <th key={col.k} className="py-2 cursor-pointer select-none" onClick={() => setSort(col.k as any)}>
                <div className="flex items-center gap-1">
                  {col.label}
                  {sortBy === col.k && <span>{sortDir === "asc" ? "▲" : "▼"}</span>}
                </div>
              </th>
            ))}
            <th className="py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => {
            const isEditing = editingId === e.id;
            return (
              <tr key={e.id} className="border-b hover:bg-muted/40">
                <td className="py-2 pr-2">
                  {isEditing ? (
                    <Input
                      type="date"
                      value={draft?.date ?? e.date}
                      onChange={(ev) => setDraft((d) => ({ ...d!, date: ev.target.value }))}
                    />
                  ) : (
                    <span>{e.date}</span>
                  )}
                </td>
                <td className="py-2 pr-2">
                  {isEditing ? (
                    <Input
                      value={draft?.restaurant ?? e.restaurant ?? ""}
                      onChange={(ev) => setDraft((d) => ({ ...d!, restaurant: ev.target.value }))}
                      placeholder="Restaurant name"
                    />
                  ) : (
                    <span className="truncate inline-block max-w-[22ch]" title={e.restaurant}>
                      {e.restaurant || "-"}
                    </span>
                  )}
                </td>
                <td className="py-2 pr-2">
                  {isEditing ? (
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={draft?.made ?? e.made}
                      onChange={(ev) => setDraft((d) => ({ ...d!, made: Number(ev.target.value) }))}
                    />
                  ) : (
                    <span>{formatUSD(e.made)}</span>
                  )}
                </td>
                <td className="py-2 pr-2">
                  {isEditing ? (
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={draft?.tipOut ?? e.tipOut}
                      onChange={(ev) => setDraft((d) => ({ ...d!, tipOut: Number(ev.target.value) }))}
                    />
                  ) : (
                    <span>{formatUSD(e.tipOut)}</span>
                  )}
                </td>
                <td className="py-2 pr-2 font-medium">{formatUSD(e.made - e.tipOut)}</td>
                <td className="py-2 pr-2">
                  {isEditing ? (
                    <Input
                      value={draft?.notes ?? e.notes ?? ""}
                      onChange={(ev) => setDraft((d) => ({ ...d!, notes: ev.target.value }))}
                    />
                  ) : (
                    <span className="truncate inline-block max-w-[22ch]" title={e.notes}>
                      {e.notes}
                    </span>
                  )}
                </td>
                <td className="py-2 flex gap-2">
                  {isEditing ? (
                    <>
                      <Button
                        size="icon"
                        variant="secondary"
                        onClick={() => {
                          const next = entries.map((x) => (x.id === e.id ? { ...(draft as TipEntry), id: e.id } : x));
                          onChange(next);
                          setEditingId(null);
                          setDraft(null);
                        }}
                      >
                        <Save className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setEditingId(null);
                          setDraft(null);
                        }}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        size="icon"
                        variant="secondary"
                        onClick={() => {
                          setEditingId(e.id);
                          setDraft(e);
                        }}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="destructive"
                        onClick={() => {
                          onChange(entries.filter((x) => x.id !== e.id));
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="text-center text-muted-foreground py-8">
                No shifts yet. Add your first one above.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function SummaryCards({ entries }: { entries: TipEntry[] }) {
  const totalMade = useMemo(() => entries.reduce((s, e) => s + e.made, 0), [entries]);
  const totalOut = useMemo(() => entries.reduce((s, e) => s + e.tipOut, 0), [entries]);
  const net = totalMade - totalOut;
  const avg = entries.length ? net / entries.length : 0;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[
        { label: "Total Made", value: formatUSD(totalMade) },
        { label: "Total Tip Out", value: formatUSD(totalOut) },
        { label: "Net", value: formatUSD(net) },
        { label: "Avg / Shift", value: formatUSD(avg) },
      ].map((c) => (
        <Card key={c.label} className="shadow-sm">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">{c.label}</div>
            <div className="text-2xl font-semibold">{c.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function Report({ entries }: { entries: TipEntry[] }) {
  const [start, setStart] = useState<string>(monthStart());
  const [end, setEnd] = useState<string>(monthEnd());

  const filtered = useMemo(() => entries.filter((e) => withinRange(e.date, start, end)), [entries, start, end]);
  const totals = useMemo(
    () => ({
      made: filtered.reduce((s, e) => s + e.made, 0),
      out: filtered.reduce((s, e) => s + e.tipOut, 0),
      net: filtered.reduce((s, e) => s + (e.made - e.tipOut), 0),
    }),
    [filtered]
  );

  const perDay = useMemo(() => {
    const map = new Map<string, { date: string; net: number }>();
    for (const e of filtered) {
      const key = e.date;
      const prev = map.get(key) || { date: key, net: 0 };
      prev.net += e.made - e.tipOut;
      map.set(key, prev);
    }
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [filtered]);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label>Start</Label>
          <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div>
          <Label>End</Label>
          <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
        <div className="flex gap-2 pb-1">
          <Button
            variant="secondary"
            onClick={() => {
              setStart(monthStart());
              setEnd(monthEnd());
            }}
          >
            This Month
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              const today = new Date();
              const prev = new Date(today.getFullYear(), today.getMonth() - 1, 1);
              const s = new Date(prev.getFullYear(), prev.getMonth(), 1).toISOString().slice(0, 10);
              const e = new Date(prev.getFullYear(), prev.getMonth() + 1, 0).toISOString().slice(0, 10);
              setStart(s);
              setEnd(e);
            }}
          >
            Last Month
          </Button>
        </div>
      </div>

      <SummaryCards entries={filtered} />

      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart2 className="w-4 h-4" />
            <div className="font-medium">Net by Day</div>
          </div>
          <div className="w-full h-64">
            <ResponsiveContainer>
              <BarChart data={perDay}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" fontSize={12} />
                <YAxis width={60} fontSize={12} />
                <RTooltip formatter={(v: number) => formatUSD(v)} labelFormatter={(l) => `Date: ${l}`} />
                <Bar dataKey="net" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground">Tip: export CSV for taxes or spreadsheets.</div>
    </div>
  );
}

export default function TipTrackerApp() {
  const [entries, setEntries] = useState<TipEntry[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [csvText, setCsvText] = useState("");

  useEffect(() => {
    setEntries(loadEntries());
  }, []);
  useEffect(() => {
    saveEntries(entries);
  }, [entries]);

  // Derived stats
  const totalNet = useMemo(() => entries.reduce((s, e) => s + (e.made - e.tipOut), 0), [entries]);

  return (
    <TooltipProvider>
      <div 
        className="min-h-dvh p-4 md:p-8 text-foreground relative"
        style={{
          backgroundImage: 'url(/main-menu-background.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundAttachment: 'fixed'
        }}
      >
        {/* Overlay to cover buttons at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background via-background/80 to-transparent pointer-events-none"></div>
        
        {/* Content */}
        <div className="relative z-10 max-w-5xl mx-auto grid gap-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl md:text-3xl font-semibold text-white drop-shadow-lg">🍽️ Tip Tracker</h1>
            <div className="flex gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const blob = new Blob([toCSV(entries)], { type: "text/csv;charset=utf-8" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = "tips.csv";
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    <FileDown className="w-4 h-4 mr-2" /> Export CSV
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Download your data</TooltipContent>
              </Tooltip>

              <Dialog open={importOpen} onOpenChange={setImportOpen}>
                <DialogTrigger asChild>
                  <Button variant="secondary">
                    <Upload className="w-4 h-4 mr-2" /> Import CSV
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Import CSV</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-3">
                    <p className="text-sm text-muted-foreground">Columns required: date, made, tipOut, restaurant, notes</p>
                    <textarea
                      className="w-full h-48 border rounded-md p-2"
                      value={csvText}
                      onChange={(e) => setCsvText(e.target.value)}
                      placeholder={`date,made,tipOut,restaurant,notes\n2025-11-02,220,40,Restaurant Name,Busy brunch`}
                    ></textarea>
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" onClick={() => setImportOpen(false)}>
                        Cancel
                      </Button>
                      <Button
                        onClick={() => {
                          try {
                            const imported = fromCSV(csvText);
                            setEntries((prev) => [...prev, ...imported].sort((a, b) => a.date.localeCompare(b.date)));
                            setCsvText("");
                            setImportOpen(false);
                          } catch (e) {
                            alert("Import failed. Check your CSV formatting.");
                          }
                        }}
                      >
                        Import
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <Tabs defaultValue="add">
            <TabsList>
              <TabsTrigger value="add">
                <Plus className="w-4 h-4 mr-1" />
                Add
              </TabsTrigger>
              <TabsTrigger value="report">
                <BarChart2 className="w-4 h-4 mr-1" />
                Report
              </TabsTrigger>
            </TabsList>
            <TabsContent value="add" className="mt-4">
              <AddEntryForm onAdd={(e) => setEntries((prev) => [e, ...prev])} />
              <div className="text-sm text-muted-foreground mt-2">Your data is saved locally on this device.</div>
              <div className="mt-6">
                <SummaryCards entries={entries} />
                <div className="mt-4">
                  <EntriesTable entries={entries} onChange={setEntries} />
                </div>
              </div>
            </TabsContent>
            <TabsContent value="report" className="mt-4">
              <Report entries={entries} />
            </TabsContent>
          </Tabs>

          <div className="text-sm text-white/90 text-center drop-shadow-md">
            Total net so far: <span className="font-semibold">{formatUSD(totalNet)}</span>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

