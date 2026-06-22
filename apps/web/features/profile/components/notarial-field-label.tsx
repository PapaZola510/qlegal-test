"use client"

import { Label } from "@/core/components/ui/label"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/core/components/ui/tooltip"

export function NotarialFieldLabel({
	htmlFor,
	label,
	sample,
}: {
	htmlFor: string
	label: string
	sample: string
}) {
	return (
		<div className="flex items-center gap-1.5">
			<Label htmlFor={htmlFor}>{label}</Label>
			<Tooltip>
				<TooltipTrigger
					render={
						<button
							type="button"
							className="text-muted-foreground hover:text-foreground inline-flex size-4 shrink-0 items-center justify-center rounded-full border text-[10px] leading-none font-semibold"
							aria-label={`Example for ${label}`}
						>
							?
						</button>
					}
				/>
				<TooltipContent className="max-w-xs text-left">
					<span className="text-background/80 block text-[10px] font-medium tracking-wide uppercase">
						Example
					</span>
					{sample}
				</TooltipContent>
			</Tooltip>
		</div>
	)
}
