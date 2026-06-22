import type { Metadata } from "next"

import { RecordingsContent } from "@/features/recordings/components/recordings-content"

export const metadata: Metadata = {
	title: "Recordings",
}

export default function RecordingsPage() {
	return <RecordingsContent />
}
