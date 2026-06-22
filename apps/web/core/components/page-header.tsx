import { cn } from "@/core/lib/utils"

interface PageHeaderProps extends React.ComponentProps<"div"> {
	title: string
	description?: string
	actions?: React.ReactNode
}

export function PageHeader({ title, description, actions, className, ...props }: PageHeaderProps) {
	return (
		<div
			className={cn(
				"flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between",
				className
			)}
			{...props}
		>
			<div className="space-y-1">
				<h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
				{description && <p className="text-muted-foreground text-sm">{description}</p>}
			</div>
			{actions && <div className="flex items-center gap-2">{actions}</div>}
		</div>
	)
}

export function Section({ className, children, ...props }: React.ComponentProps<"section">) {
	return (
		<section className={cn("space-y-4", className)} {...props}>
			{children}
		</section>
	)
}

export function ContentContainer({ className, children, ...props }: React.ComponentProps<"div">) {
	return (
		<div className={cn("mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8", className)} {...props}>
			{children}
		</div>
	)
}
