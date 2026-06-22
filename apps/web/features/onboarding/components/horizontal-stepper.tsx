"use client"

import { cn } from "@/core/lib/utils"

interface StepDef {
	key: string
	label: string
}

interface HorizontalStepperProps {
	steps: StepDef[]
	currentIndex: number
	onStepClick?: (index: number) => void
	className?: string
}

export function HorizontalStepper({
	steps,
	currentIndex,
	onStepClick,
	className,
}: HorizontalStepperProps) {
	return (
		<nav aria-label="Onboarding progress" className={cn("w-full", className)}>
			<ol className="flex items-center gap-0">
				{steps.map((step, i) => {
					const isComplete = i < currentIndex
					const isCurrent = i === currentIndex
					const isClickable = onStepClick && i <= currentIndex

					return (
						<li key={step.key} className="flex flex-1 items-center">
							<div className="flex w-full flex-col items-center gap-1.5">
								<div className="flex w-full items-center">
									{i > 0 && (
										<div
											className={cn(
												"h-0.5 flex-1 transition-colors",
												isComplete || isCurrent ? "bg-primary" : "bg-border"
											)}
										/>
									)}
									<button
										type="button"
										disabled={!isClickable}
										onClick={() => isClickable && onStepClick(i)}
										aria-current={isCurrent ? "step" : undefined}
										className={cn(
											"relative flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-all",
											isComplete && "bg-primary text-primary-foreground",
											isCurrent && "bg-primary text-primary-foreground ring-primary/20 ring-4",
											!isComplete && !isCurrent && "bg-muted text-muted-foreground",
											isClickable && "cursor-pointer hover:opacity-80",
											!isClickable && "cursor-default"
										)}
									>
										{isComplete ? (
											<svg
												className="size-4"
												fill="none"
												viewBox="0 0 24 24"
												strokeWidth={2.5}
												stroke="currentColor"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													d="M4.5 12.75l6 6 9-13.5"
												/>
											</svg>
										) : (
											i + 1
										)}
									</button>
									{i < steps.length - 1 && (
										<div
											className={cn(
												"h-0.5 flex-1 transition-colors",
												isComplete ? "bg-primary" : "bg-border"
											)}
										/>
									)}
								</div>
								<span
									className={cn(
										"text-xs font-medium",
										isCurrent
											? "text-foreground"
											: isComplete
												? "text-foreground/70"
												: "text-muted-foreground"
									)}
								>
									{step.label}
								</span>
							</div>
						</li>
					)
				})}
			</ol>
		</nav>
	)
}
