import { ScreenPlaceholder } from "@/components/ui/ScreenPlaceholder";

export default async function LetterDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <ScreenPlaceholder
      label="Letter detail"
      title="The hero screen"
      note={`Clarity statement, highlighter sweep, deadline, original German, and the locked output for letter ${id}. Built in Phase 2 & 3.`}
    />
  );
}
