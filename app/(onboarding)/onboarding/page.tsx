import { ScreenPlaceholder } from "@/components/ui/ScreenPlaceholder";

export default function OnboardingPage() {
  return (
    <div className="mx-auto min-h-dvh max-w-md">
      <ScreenPlaceholder
        label="Welcome"
        title="Klar"
        note="Pick your language and what brings you to Germany. Built in Phase 4."
      />
    </div>
  );
}
