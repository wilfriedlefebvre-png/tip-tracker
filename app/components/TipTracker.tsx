"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Edit, Save, X, Calendar, FileDown, BarChart2 } from "lucide-react";
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
  hours?: number; // hours worked
  restaurant?: string; // restaurant name
  notes?: string;
}

interface Expense {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number; // how much
  description: string; // what
}

// Helpers
const LS_KEY = "tipEntries.v1";
const LS_EXPENSES_KEY = "expenses.v1";
const LS_RESTAURANT_KEY = "lastRestaurant.v1";
const LS_RESTAURANTS_KEY = "restaurants.v1";

function getRestaurants(): string[] {
  try {
    const raw = localStorage.getItem(LS_RESTAURANTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

function saveRestaurant(name: string) {
  if (!name.trim()) return;
  try {
    const restaurants = getRestaurants();
    const trimmed = name.trim();
    if (!restaurants.includes(trimmed)) {
      restaurants.push(trimmed);
      localStorage.setItem(LS_RESTAURANTS_KEY, JSON.stringify(restaurants));
    }
  } catch {}
}

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

function loadExpenses(): Expense[] {
  try {
    const raw = localStorage.getItem(LS_EXPENSES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Expense[];
    return parsed.map((e) => ({ ...e, amount: Number(e.amount) || 0 }));
  } catch {
    return [];
  }
}

function saveExpenses(expenses: Expense[]) {
  localStorage.setItem(LS_EXPENSES_KEY, JSON.stringify(expenses));
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
  const header = ["date", "made", "tipOut", "hours", "restaurant", "notes"];
  const rows = entries.map((e) => [e.date, e.made, e.tipOut, (e.hours ?? ""), (e.restaurant ?? ""), (e.notes ?? "").replaceAll("\n", " ")]);
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
    hours: header.indexOf("hours"),
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
    const hours = Number(cols[idx.hours] ?? 0) || 0;
    const restaurant = cols[idx.restaurant]?.trim() || "";
    const notes = cols[idx.notes]?.trim() || "";
    out.push({ id: uid(), date, made, tipOut, hours: hours || undefined, restaurant: restaurant || undefined, notes });
  }
  return out;
}

// Components
function AddEntryForm({ onAdd, entries }: { onAdd: (e: TipEntry) => void; entries: TipEntry[] }) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [made, setMade] = useState("");
  const [tipOut, setTipOut] = useState("");
  const [hours, setHours] = useState("");
  const [restaurant, setRestaurant] = useState(() => {
    try {
      return localStorage.getItem(LS_RESTAURANT_KEY) || "";
    } catch {
      return "";
    }
  });
  const [notes, setNotes] = useState("");

  // Get all unique restaurant names from entries and saved restaurants
  const restaurantOptions = useMemo(() => {
    const fromEntries = entries
      .map((e) => e.restaurant)
      .filter((r): r is string => Boolean(r && r.trim()));
    const fromStorage = getRestaurants();
    const combined = [...new Set([...fromEntries, ...fromStorage])].sort();
    return combined;
  }, [entries]);

  return (
    <Card className="shadow-sm">
      <CardContent className="p-4 grid gap-4">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 items-end">
          <div>
            <Label className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Date
            </Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label>Restaurant</Label>
            <div className="relative">
              <Input
                list="restaurant-list"
                value={restaurant}
                onChange={(e) => setRestaurant(e.target.value)}
                placeholder="Select or type restaurant name"
                className="w-full"
              />
              <datalist id="restaurant-list">
                {restaurantOptions.map((r) => (
                  <option key={r} value={r} />
                ))}
              </datalist>
            </div>
          </div>
          <div>
            <Label>Made (Gross)</Label>
            <Input
              type="number"
              inputMode="decimal"
              placeholder="0.00"
              value={made}
              onChange={(e) => setMade(e.target.value)}
            />
          </div>
          <div>
            <Label>Tip Out</Label>
            <Input
              type="number"
              inputMode="decimal"
              placeholder="0.00"
              value={tipOut}
              onChange={(e) => setTipOut(e.target.value)}
            />
          </div>
          <div>
            <Label>Hours</Label>
            <Input
              type="number"
              inputMode="decimal"
              placeholder="0.0"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button
              className="mt-6 w-full"
              onClick={() => {
                if (!date) return;
                const trimmedRestaurant = restaurant.trim();
                if (trimmedRestaurant) {
                  try {
                    localStorage.setItem(LS_RESTAURANT_KEY, trimmedRestaurant);
                    saveRestaurant(trimmedRestaurant);
                  } catch {}
                }
                onAdd({ id: uid(), date, made: Number(made) || 0, tipOut: Number(tipOut) || 0, hours: Number(hours) || undefined, restaurant: trimmedRestaurant || undefined, notes });
                setMade("");
                setTipOut("");
                setHours("");
                setNotes("");
                // Keep restaurant name for next entry
                // Scroll to top
                window.scrollTo({ top: 0, behavior: 'smooth' });
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
      <table className="w-full text-sm bg-card/95 backdrop-blur-sm rounded-lg">
        <thead>
          <tr className="text-left border-b bg-card/90">
            {[
              { k: "date", label: "Date" },
              { k: "restaurant", label: "Restaurant" },
              { k: "made", label: "Made" },
              { k: "tipOut", label: "Tip Out" },
              { k: "hours", label: "Hours" },
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
              <tr key={e.id} className="border-b bg-card/80 hover:bg-card/95 transition-colors">
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
                <td className="py-2 pr-2">
                  {isEditing ? (
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={draft?.hours ?? e.hours ?? ""}
                      onChange={(ev) => setDraft((d) => ({ ...d!, hours: Number(ev.target.value) || undefined }))}
                      placeholder="0.0"
                    />
                  ) : (
                    <span>{e.hours ? e.hours.toFixed(1) : "-"}</span>
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
              <td colSpan={8} className="text-center text-muted-foreground py-8">
                No shifts yet. Add your first one above.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function AddExpenseForm({ onAdd }: { onAdd: (e: Expense) => void }) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  return (
    <Card className="shadow-sm">
      <CardContent className="p-4 grid gap-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <Label className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Date
            </Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label>Amount</Label>
            <Input
              type="number"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <Label>Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What was the expense for?"
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button
            onClick={() => {
              if (!date || !description.trim()) return;
              onAdd({ id: uid(), date, amount: Number(amount) || 0, description: description.trim() });
              setAmount("");
              setDescription("");
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            <Plus className="w-4 h-4 mr-2" /> Add Expense
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ExpensesTable({ expenses, onChange }: { expenses: Expense[]; onChange: (expenses: Expense[]) => void }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Expense | null>(null);

  const sortedExpenses = useMemo(() => {
    return [...expenses].sort((a, b) => b.date.localeCompare(a.date));
  }, [expenses]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm bg-card/95 backdrop-blur-sm rounded-lg">
        <thead>
          <tr className="text-left border-b bg-card/90">
            <th className="py-2">Date</th>
            <th className="py-2">Amount</th>
            <th className="py-2">Description</th>
            <th className="py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {sortedExpenses.map((e) => {
            const isEditing = editingId === e.id;
            return (
              <tr key={e.id} className="border-b bg-card/80 hover:bg-card/95 transition-colors">
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
                      type="number"
                      inputMode="decimal"
                      value={draft?.amount ?? e.amount}
                      onChange={(ev) => setDraft((d) => ({ ...d!, amount: Number(ev.target.value) }))}
                    />
                  ) : (
                    <span>{formatUSD(e.amount)}</span>
                  )}
                </td>
                <td className="py-2 pr-2">
                  {isEditing ? (
                    <Input
                      value={draft?.description ?? e.description}
                      onChange={(ev) => setDraft((d) => ({ ...d!, description: ev.target.value }))}
                    />
                  ) : (
                    <span className="truncate inline-block max-w-[30ch]" title={e.description}>
                      {e.description}
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
                          const next = expenses.map((x) => (x.id === e.id ? { ...(draft as Expense), id: e.id } : x));
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
                          onChange(expenses.filter((x) => x.id !== e.id));
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
          {sortedExpenses.length === 0 && (
            <tr>
              <td colSpan={4} className="text-center text-muted-foreground py-8">
                No expenses yet. Add your first one above.
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
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [fileName, setFileName] = useState("tips");

  useEffect(() => {
    const loadedEntries = loadEntries();
    setEntries(loadedEntries);
    // Populate restaurant list from existing entries
    loadedEntries.forEach((entry) => {
      if (entry.restaurant) {
        saveRestaurant(entry.restaurant);
      }
    });
    const loadedExpenses = loadExpenses();
    setExpenses(loadedExpenses);
  }, []);
  useEffect(() => {
    saveEntries(entries);
  }, [entries]);
  useEffect(() => {
    saveExpenses(expenses);
  }, [expenses]);

  // Derived stats
  const totalNet = useMemo(() => entries.reduce((s, e) => s + (e.made - e.tipOut), 0), [entries]);

  const handleDownload = () => {
    const blob = new Blob([toCSV(entries)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName.endsWith(".csv") ? fileName : `${fileName}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setDownloadOpen(false);
    setFileName("tips");
  };

  return (
    <TooltipProvider>
      <div 
        className="min-h-dvh p-4 md:p-8 text-foreground relative"
        style={{
          backgroundImage: 'url(/final-background.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundAttachment: 'fixed'
        }}
      >
        {/* Content */}
        <div className="relative z-10 max-w-5xl mx-auto grid gap-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl md:text-3xl font-semibold text-white drop-shadow-lg">🍽️ Tip Tracker</h1>
            <div className="flex gap-2">
              <Dialog open={downloadOpen} onOpenChange={setDownloadOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <FileDown className="w-4 h-4 mr-2" /> Download
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Download CSV File</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-3">
                    <div>
                      <Label htmlFor="fileName">File Name</Label>
                      <Input
                        id="fileName"
                        value={fileName}
                        onChange={(e) => setFileName(e.target.value)}
                        placeholder="tips"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleDownload();
                          }
                        }}
                      />
                      <p className="text-xs text-muted-foreground mt-1">File will be saved as {fileName || "tips"}.csv</p>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" onClick={() => {
                        setDownloadOpen(false);
                        setFileName("tips");
                      }}>
                        Cancel
                      </Button>
                      <Button onClick={handleDownload}>
                        Download
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
              <TabsTrigger value="expenses">
                💰 Expenses
              </TabsTrigger>
              <TabsTrigger value="report">
                <BarChart2 className="w-4 h-4 mr-1" />
                Report
              </TabsTrigger>
            </TabsList>
            <TabsContent value="add" className="mt-4">
              <AddEntryForm onAdd={(e) => setEntries((prev) => [e, ...prev])} entries={entries} />
              <div className="text-sm text-muted-foreground mt-2">Your data is saved locally on this device.</div>
              <div className="mt-6">
                <SummaryCards entries={entries} />
                <div className="mt-4">
                  <EntriesTable entries={entries} onChange={setEntries} />
                </div>
              </div>
            </TabsContent>
            <TabsContent value="expenses" className="mt-4">
              <AddExpenseForm onAdd={(e) => setExpenses((prev) => [e, ...prev])} />
              <div className="text-sm text-muted-foreground mt-2">Your data is saved locally on this device.</div>
              <div className="mt-6">
                <ExpensesTable expenses={expenses} onChange={setExpenses} />
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

