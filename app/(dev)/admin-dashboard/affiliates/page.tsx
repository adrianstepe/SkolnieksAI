"use client";

/**
 * Admin: Affiliate / Influencer code manager.
 *
 * - Lists all existing affiliate codes with stats.
 * - Form to create a new code (calls POST /api/admin/affiliate).
 */

import { useEffect, useState } from "react";
import { Tag, TrendingUp, Copy, CheckCheck, Plus, Loader2 } from "lucide-react";

interface AffiliateCode {
  id: string;
  code: string;
  creatorName: string;
  discountPercent: number;
  commissionPercent: number;
  active: boolean;
  totalUses: number;
  totalRevenueCents: number;
  totalCommissionCents: number;
  createdAt: string;
  stripeCouponId?: string | null;
}

function centsToEur(cents: number): string {
  return `€${(cents / 100).toFixed(2)}`;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="ml-2 inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-xs text-text-muted hover:text-text-primary transition"
      title="Kopēt"
    >
      {copied ? <CheckCheck className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
      {copied ? "Nokopēts" : "Kopēt"}
    </button>
  );
}

export default function AffiliatesPage() {
  const [codes, setCodes] = useState<AffiliateCode[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create form state
  const [form, setForm] = useState({
    code: "",
    creatorName: "",
    discountPercent: 20,
    commissionPercent: 20,
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);

  const fetchCodes = async () => {
    setLoadingList(true);
    try {
      const res = await fetch("/api/admin/affiliate");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = (await res.json()) as { codes: AffiliateCode[] };
      setCodes(data.codes);
    } catch {
      setError("Neizdevās ielādēt kodus.");
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => { void fetchCodes(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreateSuccess(null);
    setCreating(true);
    try {
      const res = await fetch("/api/admin/affiliate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.code.toUpperCase().trim(),
          creatorName: form.creatorName.trim(),
          discountPercent: form.discountPercent,
          commissionPercent: form.commissionPercent,
        }),
      });
      const data = (await res.json()) as { error?: string; code?: string; stripeCouponId?: string | null };
      if (!res.ok) {
        setCreateError(
          data.error === "code_already_exists"
            ? "Šis kods jau eksistē."
            : `Kļūda: ${data.error ?? "nezināma"}`,
        );
        return;
      }
      setCreateSuccess(
        data.stripeCouponId
          ? `Kods "${data.code}" izveidots ar Stripe kuponu.`
          : `Kods "${data.code}" izveidots (Stripe kupons netika izveidots — pārbaudi STRIPE_SECRET_KEY).`,
      );
      setForm({ code: "", creatorName: "", discountPercent: 20, commissionPercent: 20 });
      await fetchCodes();
    } catch {
      setCreateError("Servera kļūda. Mēģini vēlreiz.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-5xl space-y-8 animate-fade-up">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Affiliates & Influencers</h1>
        <p className="mt-1 text-sm text-text-muted">
          Izveido promo kodus TikTokeriem — lietotāji saņem atlaidi, influenceris saņem komisiju.
        </p>
      </div>

      {/* Create form */}
      <div className="rounded-2xl border border-border bg-surface/40 p-6">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-text-primary">
          <Plus className="h-4 w-4 text-accent" />
          Jauns affiliate kods
        </h2>
        <form onSubmit={(e) => { void handleCreate(e); }} className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Kods</label>
            <input
              required
              maxLength={20}
              pattern="[A-Z0-9_\-]+"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
              placeholder="TIKTOKER20"
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
            <p className="mt-1 text-[10px] text-text-muted">Tikai lielie burti, cipari, - vai _</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Influencera vārds</label>
            <input
              required
              maxLength={80}
              value={form.creatorName}
              onChange={(e) => setForm((f) => ({ ...f, creatorName: e.target.value }))}
              placeholder="JanisTikTok"
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">
              Lietotāja atlaide (%)
            </label>
            <input
              required
              type="number"
              min={1}
              max={80}
              value={form.discountPercent}
              onChange={(e) => setForm((f) => ({ ...f, discountPercent: Number(e.target.value) }))}
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">
              Influencera komisija (%)
            </label>
            <input
              required
              type="number"
              min={1}
              max={80}
              value={form.commissionPercent}
              onChange={(e) => setForm((f) => ({ ...f, commissionPercent: Number(e.target.value) }))}
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
          </div>
          <div className="sm:col-span-2 flex flex-col gap-2">
            {createError && (
              <p className="text-sm text-red-500">{createError}</p>
            )}
            {createSuccess && (
              <p className="text-sm text-emerald-500">{createSuccess}</p>
            )}
            <button
              type="submit"
              disabled={creating}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accent/90 disabled:opacity-50 disabled:pointer-events-none"
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {creating ? "Izveido..." : "Izveidot kodu"}
            </button>
          </div>
        </form>
      </div>

      {/* Code list */}
      <div className="rounded-2xl border border-border bg-surface/40 p-6">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-text-primary">
          <Tag className="h-4 w-4 text-accent" />
          Aktīvie kodi
        </h2>

        {loadingList ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
          </div>
        ) : error ? (
          <p className="text-sm text-red-500">{error}</p>
        ) : codes.length === 0 ? (
          <p className="text-sm text-text-muted">Nav neviena koda. Izveido pirmo augstāk!</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-text-muted">
                  <th className="pb-2 pr-4 font-medium">Kods</th>
                  <th className="pb-2 pr-4 font-medium">Influenceris</th>
                  <th className="pb-2 pr-4 font-medium">Atlaide</th>
                  <th className="pb-2 pr-4 font-medium">Komisija</th>
                  <th className="pb-2 pr-4 font-medium">Izmantots</th>
                  <th className="pb-2 pr-4 font-medium">Ieņēmumi</th>
                  <th className="pb-2 font-medium">Komisija €</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {codes.map((c) => {
                  const shareUrl = `https://skolnieksai.lv/signup?invite=${c.code}`;
                  return (
                    <tr key={c.id} className="group">
                      <td className="py-3 pr-4">
                        <span className="rounded-md bg-accent/10 px-2 py-0.5 font-mono text-xs font-semibold text-accent">
                          {c.code}
                        </span>
                        <CopyButton text={shareUrl} />
                      </td>
                      <td className="py-3 pr-4 text-text-secondary">{c.creatorName}</td>
                      <td className="py-3 pr-4 font-medium text-emerald-600 dark:text-emerald-400">
                        {c.discountPercent}%
                      </td>
                      <td className="py-3 pr-4 text-text-secondary">{c.commissionPercent}%</td>
                      <td className="py-3 pr-4 text-text-secondary">{c.totalUses}</td>
                      <td className="py-3 pr-4 text-text-secondary">
                        {centsToEur(c.totalRevenueCents)}
                      </td>
                      <td className="py-3 flex items-center gap-2 text-text-secondary">
                        <TrendingUp className="h-3.5 w-3.5 text-accent shrink-0" />
                        {centsToEur(c.totalCommissionCents)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-text-muted">
        Komisijas tiek aprēķinātas automātiski no Stripe webhook. Izmaksā manuāli ik mēnesi.
      </p>
    </div>
  );
}
