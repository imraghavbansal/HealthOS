import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
import { AsyncBoundary, EmptyState } from "@/components/data-states";
import { AnimatePresence, ProgressRing, Stagger, StaggerItem, motion } from "@/components/motion";
import { useAddGoal, useDeleteGoal, useGoals, useUpdateGoal } from "@/lib/queries";
import type { Goal } from "@/lib/types";
import { Flame, Plus, Target, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/goals")({
  head: () => ({
    meta: [
      { title: "Health Goals - Raag" },
      { name: "description", content: "Outcomes worth tracking, not just steps." },
      { property: "og:title", content: "Health Goals - Raag" },
      { property: "og:description", content: "Outcomes worth tracking, not just steps." },
    ],
  }),
  component: Goals,
});

const CATEGORIES = ["Sleep", "Activity", "Labs", "Exercise", "Nutrition", "Mind"];

function Goals() {
  const goalsQuery = useGoals();
  const [open, setOpen] = useState(false);

  return (
    <AppShell
      title="Health Goals"
      subtitle="Outcomes worth tracking, not just steps."
      actions={<AddGoalDialog open={open} onOpenChange={setOpen} />}
    >
      <AsyncBoundary
        query={goalsQuery}
        empty={
          <EmptyState
            icon={Target}
            title="No goals yet"
            body="Create your first goal to start tracking progress."
          />
        }
      >
        {(goals) => <GoalsBody goals={goals} />}
      </AsyncBoundary>
    </AppShell>
  );
}

function AddGoalDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const add = useAddGoal();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [target, setTarget] = useState("");
  const [dueDate, setDueDate] = useState("");

  const reset = () => {
    setTitle("");
    setCategory(CATEGORIES[0]);
    setTarget("");
    setDueDate("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button className="rounded-full gradient-primary text-white border-0">
          <Plus className="mr-1 h-4 w-4" /> New goal
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New goal</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="goal-title">Title</Label>
            <Input
              id="goal-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Sleep 8 hours nightly"
            />
          </div>
          <div>
            <Label htmlFor="goal-category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="goal-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="goal-target">Target</Label>
            <Input
              id="goal-target"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="8 hrs/night"
            />
          </div>
          <div>
            <Label htmlFor="goal-due">Due date</Label>
            <Input
              id="goal-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            className="rounded-full gradient-primary text-white border-0"
            disabled={!title || add.isPending}
            onClick={() => {
              add.mutate(
                { title, category, target, dueDate },
                {
                  onSuccess: () => {
                    reset();
                    onOpenChange(false);
                  },
                },
              );
            }}
          >
            Create goal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GoalsBody({ goals }: { goals: Goal[] }) {
  const update = useUpdateGoal();
  const del = useDeleteGoal();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const categories = useMemo(() => Array.from(new Set(goals.map((g) => g.category))), [goals]);
  const filtered = activeCategory ? goals.filter((g) => g.category === activeCategory) : goals;
  const onTrack = goals.filter((g) => g.progress >= 70).length;
  const overallPct = goals.length ? Math.round((onTrack / goals.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-[auto_1fr] gap-4 items-center">
        <Card className="rounded-3xl border-border/60">
          <CardContent className="p-5 flex items-center gap-4">
            <ProgressRing
              value={overallPct}
              size={88}
              stroke={8}
              label={<div className="font-display text-lg">{overallPct}%</div>}
            />
            <div>
              <div className="text-sm font-semibold">Goals on track</div>
              <div className="text-xs text-muted-foreground">
                {onTrack} of {goals.length} at 70%+ progress
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="flex flex-wrap gap-1.5">
          <Badge
            onClick={() => setActiveCategory(null)}
            variant={activeCategory === null ? "default" : "secondary"}
            className="rounded-full cursor-pointer text-[10px]"
          >
            All
          </Badge>
          {categories.map((c) => (
            <Badge
              key={c}
              onClick={() => setActiveCategory(c)}
              variant={activeCategory === c ? "default" : "secondary"}
              className="rounded-full cursor-pointer text-[10px]"
            >
              {c}
            </Badge>
          ))}
        </div>
      </div>

      <AnimatePresence>
        <Stagger className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((g) => (
            <StaggerItem key={g.id}>
              <GoalCard
                goal={g}
                onCommit={(v) => update.mutate({ id: g.id, patch: { progress: v } })}
                onDelete={() => del.mutate(g.id)}
              />
            </StaggerItem>
          ))}
        </Stagger>
      </AnimatePresence>
    </div>
  );
}

function GoalCard({
  goal,
  onCommit,
  onDelete,
}: {
  goal: Goal;
  onCommit: (v: number) => void;
  onDelete: () => void;
}) {
  const [value, setValue] = useState(goal.progress);
  const complete = value >= 100;

  return (
    <motion.div layout exit={{ opacity: 0, scale: 0.94 }}>
      <Card className="rounded-3xl border-border/60 overflow-hidden relative">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="h-11 w-11 rounded-2xl gradient-primary grid place-items-center text-white">
              <Target className="h-5 w-5" />
            </div>
            <div className="flex items-center gap-1.5">
              <Badge variant="secondary" className="rounded-full text-[10px]">
                {goal.category}
              </Badge>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="rounded-full h-7 w-7 text-muted-foreground"
                    aria-label="Delete goal"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this goal?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will remove "{goal.title}" permanently.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
          <div className="mt-4 font-semibold">{goal.title}</div>
          {goal.target && (
            <div className="text-xs text-muted-foreground">Target: {goal.target}</div>
          )}
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
              <span>Progress</span>
              <motion.span
                className="font-semibold text-foreground"
                animate={complete ? { scale: [1, 1.3, 1] } : {}}
                transition={{ duration: 0.5 }}
              >
                {value}%
              </motion.span>
            </div>
            <Slider
              value={[value]}
              max={100}
              step={1}
              onValueChange={([v]) => setValue(v)}
              onValueCommit={([v]) => onCommit(v)}
            />
          </div>
          <div className="mt-4 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1 text-warning-foreground">
              <Flame className="h-3.5 w-3.5" /> {goal.streak}-day streak
            </div>
            {goal.dueDate && <span className="text-muted-foreground">Due {goal.dueDate}</span>}
          </div>
        </CardContent>
        {complete && (
          <motion.div
            className="pointer-events-none absolute inset-0"
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 1.4 }}
          >
            {Array.from({ length: 10 }).map((_, i) => (
              <span
                key={i}
                className="absolute h-1.5 w-1.5 rounded-full bg-primary"
                style={{
                  left: `${10 + i * 8}%`,
                  top: "50%",
                  transform: `translateY(${i % 2 === 0 ? "-30px" : "30px"})`,
                }}
              />
            ))}
          </motion.div>
        )}
      </Card>
    </motion.div>
  );
}
