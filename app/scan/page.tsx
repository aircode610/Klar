import { ScreenPlaceholder } from "@/components/ui/ScreenPlaceholder";

export default function ScanPage() {
  return (
    <div className="mx-auto min-h-dvh max-w-md">
      <ScreenPlaceholder
        label="Capture"
        title="Scan a letter"
        note="Camera-first capture with a framing hint, then preview and confirm. Built in Phase 2."
      />
    </div>
  );
}
