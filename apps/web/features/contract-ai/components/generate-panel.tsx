"use client"

import * as React from "react"

import { Button } from "@/core/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/core/components/ui/card"
import { Input } from "@/core/components/ui/input"
import { Label } from "@/core/components/ui/label"
import { ScrollArea } from "@/core/components/ui/scroll-area"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/core/components/ui/select"
import { Separator } from "@/core/components/ui/separator"
import { Skeleton } from "@/core/components/ui/skeleton"
import { Textarea } from "@/core/components/ui/textarea"
import { cn } from "@/core/lib/utils"
import { FIXTURE_TEMPLATES, type GenerateTemplate } from "@/features/contract-ai/lib/fixtures"

type Phase = "select" | "generating" | "done"

export function GeneratePanel() {
	const [phase, setPhase] = React.useState<Phase>("select")
	const [selectedTemplate, setSelectedTemplate] = React.useState<GenerateTemplate | null>(null)
	const [prompt, setPrompt] = React.useState("")

	function handleGenerate() {
		if (!selectedTemplate) return
		setPhase("generating")
		setTimeout(() => setPhase("done"), 2500)
	}

	if (phase === "generating") {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Generating Draft…</CardTitle>
					<CardDescription>
						Creating {selectedTemplate?.name} based on your instructions.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<Skeleton className="h-4 w-full" />
					<Skeleton className="h-4 w-5/6" />
					<Skeleton className="h-4 w-3/4" />
					<Skeleton className="h-64 w-full" />
				</CardContent>
			</Card>
		)
	}

	if (phase === "done") {
		return (
			<div className="space-y-4">
				<Card>
					<CardHeader>
						<CardTitle>Generated Draft: {selectedTemplate?.name}</CardTitle>
						<CardDescription>
							Review the AI-generated draft below. You can edit or download it.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<ScrollArea className="h-96 rounded-md border p-4">
							<div className="prose prose-sm dark:prose-invert max-w-none">
								<h3>DEED OF ABSOLUTE SALE</h3>
								<p>
									<strong>KNOW ALL MEN BY THESE PRESENTS:</strong>
								</p>
								<p>This Deed of Absolute Sale is entered into by and between:</p>
								<p>
									<strong>VENDOR:</strong> [Name], of legal age, Filipino, with residence at
									[Address], hereinafter referred to as the &quot;VENDOR&quot;;
								</p>
								<p>
									<strong>VENDEE:</strong> [Name], of legal age, Filipino, with residence at
									[Address], hereinafter referred to as the &quot;VENDEE&quot;;
								</p>
								<h4>WITNESSETH:</h4>
								<p>
									WHEREAS, the VENDOR is the registered owner of a parcel of land situated at
									[Location], covered by Transfer Certificate of Title No. [TCT No.] of the Registry
									of Deeds of [City/Province];
								</p>
								<p>
									WHEREAS, the VENDOR has agreed to sell, transfer, and convey the said property to
									the VENDEE for a total consideration of [Amount in words] (PHP [Amount]);
								</p>
								<p className="text-muted-foreground italic">[… continued draft content …]</p>
							</div>
						</ScrollArea>
					</CardContent>
				</Card>
				<div className="flex gap-2">
					<Button variant="outline" onClick={() => setPhase("select")}>
						Start Over
					</Button>
					<Button>Download Draft</Button>
				</div>
			</div>
		)
	}

	const categories = [...new Set(FIXTURE_TEMPLATES.map(t => t.category))]

	return (
		<div className="grid gap-6 lg:grid-cols-2">
			<Card>
				<CardHeader>
					<CardTitle>Select Template</CardTitle>
					<CardDescription>Choose a document template to generate.</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3">
					{categories.map(cat => (
						<div key={cat}>
							<p className="text-muted-foreground mb-2 text-xs font-medium tracking-wider uppercase">
								{cat}
							</p>
							{FIXTURE_TEMPLATES.filter(t => t.category === cat).map(t => (
								<button
									key={t.id}
									type="button"
									onClick={() => setSelectedTemplate(t)}
									className={cn(
										"mb-1 w-full rounded-lg border p-3 text-left transition-colors",
										selectedTemplate?.id === t.id ? "border-primary bg-primary/5" : "hover:bg-muted"
									)}
								>
									<p className="text-sm font-medium">{t.name}</p>
									<p className="text-muted-foreground text-xs">{t.description}</p>
								</button>
							))}
							<Separator className="my-3" />
						</div>
					))}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Customize</CardTitle>
					<CardDescription>
						Provide details for the AI to generate a tailored draft.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="space-y-2">
						<Label>Template</Label>
						<Select
							value={selectedTemplate?.id ?? ""}
							onValueChange={v =>
								setSelectedTemplate(FIXTURE_TEMPLATES.find(t => t.id === v) ?? null)
							}
						>
							<SelectTrigger>
								<SelectValue>
									{selectedTemplate ? selectedTemplate.name : "Choose template…"}
								</SelectValue>
							</SelectTrigger>
							<SelectContent>
								{FIXTURE_TEMPLATES.map(t => (
									<SelectItem key={t.id} value={t.id}>
										{t.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<Label>Party Names</Label>
						<Input placeholder="e.g. Juan Dela Cruz, Carmen Lim" />
					</div>

					<div className="space-y-2">
						<Label>Additional Instructions</Label>
						<Textarea
							placeholder="Describe any specific clauses, terms, or details…"
							rows={5}
							value={prompt}
							onChange={e => setPrompt(e.target.value)}
						/>
					</div>

					<Button onClick={handleGenerate} disabled={!selectedTemplate} className="w-full">
						Generate Draft
					</Button>
				</CardContent>
			</Card>
		</div>
	)
}
