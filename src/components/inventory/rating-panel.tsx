"use client";

import { Star } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { deleteRatingAction, rateAction } from "@/lib/actions/inventory";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";

export interface RatingEntry {
  user_id: string;
  rating: number;
  notes: string | null;
  profile: { display_name: string | null; email: string | null } | null;
}

function Stars({ value, onChange, label }: { value: number; onChange?: (v: number) => void; label: string }) {
  const [hover, setHover] = React.useState(0);
  const shown = hover || value;
  if (!onChange) {
    return (
      <span className="inline-flex" role="img" aria-label={`${value} out of 5 stars`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Star key={n} className={cn("size-3.5", n <= value ? "fill-warning text-warning" : "text-border-strong")} aria-hidden />
        ))}
      </span>
    );
  }
  return (
    <div className="flex" role="radiogroup" aria-label={label} onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          onMouseEnter={() => setHover(n)}
          onClick={() => onChange(n)}
          className="inline-flex size-10 items-center justify-center rounded-md sm:size-8"
        >
          <Star className={cn("size-5 transition-colors", n <= shown ? "fill-warning text-warning" : "text-border-strong")} aria-hidden />
        </button>
      ))}
    </div>
  );
}

function RatingBlock({
  title,
  target,
  targetId,
  userId,
  entries,
}: {
  title: string;
  target: "product" | "brand";
  targetId: string;
  userId: string;
  entries: RatingEntry[];
}) {
  const router = useRouter();
  const mine = entries.find((e) => e.user_id === userId);
  const others = entries.filter((e) => e.user_id !== userId);
  const [rating, setRating] = React.useState(mine?.rating ?? 0);
  const [notes, setNotes] = React.useState(mine?.notes ?? "");
  const [pending, startTransition] = React.useTransition();
  const average = entries.length ? entries.reduce((s, e) => s + e.rating, 0) / entries.length : 0;

  const save = () =>
    startTransition(async () => {
      const result = await rateAction({ target, targetId, rating, notes });
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else toast.error(result.error);
    });
  const clear = () =>
    startTransition(async () => {
      const result = await deleteRatingAction(target, targetId);
      if (result.ok) {
        setRating(0);
        setNotes("");
        toast.success(result.message);
        router.refresh();
      } else toast.error(result.error);
    });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium">{title}</h3>
        {entries.length ? (
          <span className="text-xs text-muted-foreground tabular">
            {average.toFixed(1)} avg · {entries.length} {entries.length === 1 ? "rating" : "ratings"}
          </span>
        ) : null}
      </div>
      <Stars value={rating} onChange={setRating} label={`Your rating for ${title}`} />
      <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Your notes (taste, value, would buy again?)" aria-label={`Notes for ${title}`} maxLength={1000} />
      <div className="flex gap-2">
        <Button size="sm" onClick={save} disabled={rating === 0} loading={pending}>
          {mine ? "Update rating" : "Save rating"}
        </Button>
        {mine ? (
          <Button size="sm" variant="ghost" onClick={clear} disabled={pending}>
            Remove
          </Button>
        ) : null}
      </div>
      {others.length ? (
        <ul className="mt-1 flex flex-col gap-2 border-t border-border pt-3">
          {others.map((o) => (
            <li key={o.user_id} className="text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium">{o.profile?.display_name || o.profile?.email || "Household member"}</span>
                <Stars value={o.rating} label="" />
              </div>
              {o.notes ? <p className="mt-0.5 text-muted-foreground">{o.notes}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function RatingPanel({
  productId,
  productName,
  brandId,
  brandName,
  userId,
  productRatings,
  brandRatings,
}: {
  productId: string;
  productName: string;
  brandId: string | null;
  brandName: string | null;
  userId: string;
  productRatings: RatingEntry[];
  brandRatings: RatingEntry[];
}) {
  return (
    <div className="flex flex-col gap-6">
      <RatingBlock title={productName} target="product" targetId={productId} userId={userId} entries={productRatings} />
      {brandId && brandName ? (
        <RatingBlock title={`Brand: ${brandName}`} target="brand" targetId={brandId} userId={userId} entries={brandRatings} />
      ) : null}
    </div>
  );
}
