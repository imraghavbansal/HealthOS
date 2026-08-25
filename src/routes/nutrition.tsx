import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AnimatePresence } from "motion/react";
import { AppShell } from "@/components/app-shell";
import { AsyncBoundary, EmptyState, LoadingCards } from "@/components/data-states";
import {
  AnimatedNumber,
  Lift,
  ProgressRing,
  Reveal,
  Stagger,
  StaggerItem,
  motion,
} from "@/components/motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAddNutrition, useAddWater, useNutrition } from "@/lib/queries";
import type { NutritionEntry } from "@/lib/types";
import { Droplet, GlassWater, Minus, Plus, UtensilsCrossed } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

export const Route = createFileRoute("/nutrition")({
  component: NutritionPage,
  head: () => ({
    meta: [
      { title: "Nutrition & Hydration - Raag" },
      { name: "description", content: "Track meals, macros and hydration in one place." },
      { property: "og:title", content: "Nutrition & Hydration - Raag" },
      { property: "og:description", content: "Track meals, macros and hydration in one place." },
    ],
  }),
});

const MEALS: NutritionEntry["meal"][] = ["Breakfast", "Lunch", "Dinner", "Snack"];

const COMMON_FOODS: Array<
  Pick<NutritionEntry, "meal" | "name" | "kcal" | "protein" | "carbs" | "fat">
> = [
  { meal: "Breakfast", name: "Greek yogurt & berries", kcal: 220, protein: 18, carbs: 26, fat: 5 },
  { meal: "Lunch", name: "Grilled chicken bowl", kcal: 540, protein: 42, carbs: 48, fat: 16 },
  { meal: "Snack", name: "Almonds (1 oz)", kcal: 160, protein: 6, carbs: 6, fat: 14 },
  { meal: "Dinner", name: "Salmon & quinoa", kcal: 610, protein: 38, carbs: 44, fat: 24 },
];

function NutritionPage() {
  const nutrition = useNutrition();

  return (
    <AppShell
      title="Nutrition & Hydration"
      subtitle="Fuel and fluids, tracked at a glance."
      actions={<LogMealDialog />}
    >
      <div className="space-y-6">
        <AsyncBoundary query={nutrition} skeleton={<LoadingCards count={4} />}>
          {(data) => <NutritionContent data={data} />}
        </AsyncBoundary>
        <p className="text-xs text-muted-foreground">Informational only - not medical advice.</p>
      </div>
    </AppShell>
  );
}

function NutritionContent({
  data,
}: {
  data: {
    entries: NutritionEntry[];
    targets: import("@/lib/types").NutritionTargets;
    waterMl: number;
  };
}) {
  const { entries, targets, waterMl } = data;

  const consumed = useMemo(
    () =>
      entries.reduce(
        (acc, e) => ({
          kcal: acc.kcal + e.kcal,
          protein: acc.protein + e.protein,
          carbs: acc.carbs + e.carbs,
          fat: acc.fat + e.fat,
        }),
        { kcal: 0, protein: 0, carbs: 0, fat: 0 },
      ),
    [entries],
  );

  const kcalPct = Math.min(100, Math.round((consumed.kcal / Math.max(1, targets.kcal)) * 100));

  const macros = [
    {
      key: "protein",
      label: "Protein",
      value: consumed.protein,
      target: targets.protein,
      color: "var(--chart-1)",
    },
    {
      key: "carbs",
      label: "Carbs",
      value: consumed.carbs,
      target: targets.carbs,
      color: "var(--chart-2)",
    },
    { key: "fat", label: "Fat", value: consumed.fat, target: targets.fat, color: "var(--chart-3)" },
  ];

  const pieData = [
    { name: "Protein", value: consumed.protein * 4, color: "var(--chart-1)" },
    { name: "Carbs", value: consumed.carbs * 4, color: "var(--chart-2)" },
    { name: "Fat", value: consumed.fat * 9, color: "var(--chart-3)" },
  ].filter((d) => d.value > 0);

  const grouped = useMemo(() => {
    const map = new Map<NutritionEntry["meal"], NutritionEntry[]>();
    for (const meal of MEALS) map.set(meal, []);
    for (const e of entries) map.get(e.meal)?.push(e);
    return map;
  }, [entries]);

  return (
    <div className="space-y-6">
      <Reveal>
        <div className="grid gap-4 lg:grid-cols-3">
          <Lift className="lg:col-span-1">
            <Card className="rounded-3xl border-border/60 h-full">
              <CardContent className="p-6 flex flex-col items-center justify-center gap-3">
                <ProgressRing
                  value={kcalPct}
                  label={
                    <div className="text-center">
                      <div className="font-display text-2xl">
                        <AnimatedNumber value={consumed.kcal} />
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        of {targets.kcal} kcal
                      </div>
                    </div>
                  }
                />
                <div className="text-xs text-muted-foreground">
                  {kcalPct}% of daily calorie target
                </div>
              </CardContent>
            </Card>
          </Lift>

          <div className="lg:col-span-2 grid gap-4 sm:grid-cols-3">
            {macros.map((m) => {
              const pct = Math.min(100, Math.round((m.value / Math.max(1, m.target)) * 100));
              return (
                <Lift key={m.key}>
                  <Card className="rounded-3xl border-border/60 h-full">
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{m.label}</span>
                        <span className="font-semibold">{pct}%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ backgroundColor: m.color }}
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                        />
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {Math.round(m.value)}g / {m.target}g
                      </div>
                    </CardContent>
                  </Card>
                </Lift>
              );
            })}
          </div>
        </div>
      </Reveal>

      <div className="grid gap-4 lg:grid-cols-3">
        <Reveal className="lg:col-span-2" delay={0.05}>
          <HydrationCard waterMl={waterMl} targetMl={targets.waterMl} />
        </Reveal>
        <Reveal delay={0.1}>
          <Card className="rounded-3xl border-border/60 h-full">
            <CardContent className="p-5">
              <div className="font-display text-base mb-2">Macro split</div>
              {pieData.length === 0 ? (
                <div className="py-10 text-center text-xs text-muted-foreground">
                  Log a meal to see your split.
                </div>
              ) : (
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                      >
                        {pieData.map((d) => (
                          <Cell key={d.name} fill={d.color} stroke="none" />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          borderRadius: 12,
                          border: "1px solid var(--border)",
                          background: "var(--card)",
                          fontSize: 12,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="mt-2 flex flex-wrap gap-2 justify-center">
                {pieData.map((d) => (
                  <span
                    key={d.name}
                    className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
                  >
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: d.color }} />
                    {d.name}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        </Reveal>
      </div>

      <Reveal delay={0.1}>
        <div className="font-display text-lg mb-3">Today's log</div>
        {entries.length === 0 ? (
          <EmptyState
            icon={UtensilsCrossed}
            title="No meals logged yet"
            body="Use “Log a meal” to add your first entry."
          />
        ) : (
          <div className="space-y-5">
            {MEALS.map((meal) => {
              const items = grouped.get(meal) ?? [];
              if (items.length === 0) return null;
              return (
                <div key={meal}>
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    {meal}
                  </div>
                  <Stagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <AnimatePresence>
                      {items.map((e) => (
                        <StaggerItem key={e.id}>
                          <motion.div layout>
                            <Card className="rounded-2xl border-border/60">
                              <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                  <div className="font-medium text-sm">{e.name}</div>
                                  <div className="text-sm font-semibold">{e.kcal} kcal</div>
                                </div>
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  <Badge variant="secondary" className="rounded-full text-[10px]">
                                    P {e.protein}g
                                  </Badge>
                                  <Badge variant="secondary" className="rounded-full text-[10px]">
                                    C {e.carbs}g
                                  </Badge>
                                  <Badge variant="secondary" className="rounded-full text-[10px]">
                                    F {e.fat}g
                                  </Badge>
                                </div>
                              </CardContent>
                            </Card>
                          </motion.div>
                        </StaggerItem>
                      ))}
                    </AnimatePresence>
                  </Stagger>
                </div>
              );
            })}
          </div>
        )}
      </Reveal>
    </div>
  );
}

function HydrationCard({ waterMl, targetMl }: { waterMl: number; targetMl: number }) {
  const addWater = useAddWater();
  const pct = Math.min(100, Math.round((waterMl / Math.max(1, targetMl)) * 100));
  const remaining = Math.max(0, targetMl - waterMl);

  return (
    <Card className="rounded-3xl border-border/60 h-full overflow-hidden">
      <CardContent className="p-5 flex flex-col sm:flex-row gap-5 items-center">
        <div className="relative h-40 w-24 rounded-2xl border border-border/60 bg-muted/40 overflow-hidden shrink-0">
          <motion.div
            className="absolute bottom-0 left-0 right-0 bg-teal/70"
            initial={{ height: 0 }}
            animate={{ height: `${pct}%` }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          />
          <div className="absolute inset-0 grid place-items-center">
            <Droplet className="h-6 w-6 text-primary drop-shadow" />
          </div>
        </div>
        <div className="flex-1 w-full space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-display text-xl">
                <AnimatedNumber value={waterMl} /> ml
              </div>
              <div className="text-xs text-muted-foreground">
                {remaining > 0 ? `${remaining} ml remaining` : "Goal reached - nice work!"} · target{" "}
                {targetMl} ml
              </div>
            </div>
            <Badge variant="secondary" className="rounded-full">
              {pct}%
            </Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              className="rounded-full"
              disabled={addWater.isPending}
              onClick={() => addWater.mutate(250)}
            >
              <GlassWater className="mr-1.5 h-4 w-4" /> +250ml glass
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="rounded-full"
              disabled={addWater.isPending}
              onClick={() => addWater.mutate(500)}
            >
              <Plus className="mr-1.5 h-4 w-4" /> +500ml bottle
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="rounded-full"
              disabled={addWater.isPending}
              onClick={() => addWater.mutate(750)}
            >
              <Plus className="mr-1.5 h-4 w-4" /> +750ml
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="rounded-full"
              aria-label="Remove 250ml"
              disabled={addWater.isPending || waterMl <= 0}
              onClick={() => addWater.mutate(-250)}
            >
              <Minus className="mr-1.5 h-4 w-4" /> 250ml
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LogMealDialog() {
  const [open, setOpen] = useState(false);
  const [meal, setMeal] = useState<NutritionEntry["meal"]>("Breakfast");
  const [name, setName] = useState("");
  const [kcal, setKcal] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const addNutrition = useAddNutrition();

  function reset() {
    setMeal("Breakfast");
    setName("");
    setKcal("");
    setProtein("");
    setCarbs("");
    setFat("");
  }

  function applyPreset(p: (typeof COMMON_FOODS)[number]) {
    setMeal(p.meal);
    setName(p.name);
    setKcal(String(p.kcal));
    setProtein(String(p.protein));
    setCarbs(String(p.carbs));
    setFat(String(p.fat));
  }

  function submit() {
    if (!name.trim()) return;
    addNutrition.mutate(
      {
        meal,
        name: name.trim(),
        kcal: Number(kcal) || 0,
        protein: Number(protein) || 0,
        carbs: Number(carbs) || 0,
        fat: Number(fat) || 0,
        loggedAt: new Date().toISOString(),
      },
      {
        onSuccess: () => {
          setOpen(false);
          reset();
        },
      },
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button className="rounded-full gradient-primary text-white border-0">
          <Plus className="mr-1.5 h-4 w-4" /> Log a meal
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log a meal</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {COMMON_FOODS.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => applyPreset(p)}
                className="rounded-full border border-border/60 bg-muted/40 px-3 py-1.5 text-xs hover:bg-muted transition-colors"
              >
                {p.name}
              </button>
            ))}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="meal-select">Meal</Label>
            <Select value={meal} onValueChange={(v) => setMeal(v as NutritionEntry["meal"])}>
              <SelectTrigger id="meal-select" className="rounded-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MEALS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="meal-name">Food name</Label>
            <Input
              id="meal-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Chicken salad"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="meal-kcal">Calories (kcal)</Label>
              <Input
                id="meal-kcal"
                type="number"
                min={0}
                value={kcal}
                onChange={(e) => setKcal(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="meal-protein">Protein (g)</Label>
              <Input
                id="meal-protein"
                type="number"
                min={0}
                value={protein}
                onChange={(e) => setProtein(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="meal-carbs">Carbs (g)</Label>
              <Input
                id="meal-carbs"
                type="number"
                min={0}
                value={carbs}
                onChange={(e) => setCarbs(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="meal-fat">Fat (g)</Label>
              <Input
                id="meal-fat"
                type="number"
                min={0}
                value={fat}
                onChange={(e) => setFat(e.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="rounded-full" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            className="rounded-full gradient-primary text-white border-0"
            disabled={!name.trim() || addNutrition.isPending}
            onClick={submit}
          >
            Save meal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
