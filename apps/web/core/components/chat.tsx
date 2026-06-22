"use client"

import * as React from "react"

import { Avatar, AvatarFallback, AvatarImage } from "@/core/components/ui/avatar"
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/core/components/ui/tooltip"
import { cn } from "@/core/lib/utils"

type ChatBubbleContextValue = {
	variant: "sent" | "received"
	isFirst: boolean
	isLast: boolean
}

const ChatBubbleContext = React.createContext<ChatBubbleContextValue>({
	variant: "received",
	isFirst: true,
	isLast: true,
})

export function useChatBubble() {
	return React.useContext(ChatBubbleContext)
}

export function getBubbleBorderRadius(
	variant: "sent" | "received",
	isFirst: boolean,
	isLast: boolean
): string {
	const both = isFirst && isLast
	if (variant === "sent") {
		if (both) return "rounded-2xl"
		if (isFirst && !isLast) return "rounded-2xl rounded-br-xs"
		if (isLast && !isFirst) return "rounded-2xl rounded-tr-xs"
		return "rounded-2xl rounded-tr-xs rounded-br-xs"
	}

	if (both) return "rounded-2xl"
	if (isFirst && !isLast) return "rounded-2xl rounded-bl-xs"
	if (isLast && !isFirst) return "rounded-2xl rounded-tl-xs"
	return "rounded-2xl rounded-tl-xs rounded-bl-xs"
}

function ChatList({ children, className }: { children: React.ReactNode; className?: string }) {
	return <div className={cn("space-y-1 pb-3", className)}>{children}</div>
}

type ChatBubbleProps = {
	variant: "sent" | "received"
	isFirst?: boolean
	isLast?: boolean
	children: React.ReactNode
	className?: string
	onClick?: () => void
	timestamp?: string
}

function ChatBubble({
	variant,
	isFirst = true,
	isLast = true,
	children,
	className,
	onClick,
	timestamp,
}: ChatBubbleProps) {
	const inner = (
		<div
			className={cn(
				"flex max-w-[70%] items-start gap-2",
				variant === "sent" && "flex-row-reverse",
				onClick && "cursor-pointer"
			)}
			onClick={onClick}
		>
			{children}
		</div>
	)

	return (
		<ChatBubbleContext.Provider value={{ variant, isFirst, isLast }}>
			<div className={cn("flex", variant === "sent" ? "justify-end" : "justify-start", className)}>
				{timestamp ? (
					<TooltipProvider delay={300}>
						<Tooltip>
							<TooltipTrigger render={inner} />
							<TooltipContent side="top" align="end">
								{timestamp}
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				) : (
					inner
				)}
			</div>
		</ChatBubbleContext.Provider>
	)
}

type ChatBubbleAvatarProps = {
	src?: string
	fallback?: string
	showAvatar?: boolean
	className?: string
}

function ChatBubbleAvatar({ src, fallback, showAvatar = true, className }: ChatBubbleAvatarProps) {
	const { variant } = useChatBubble()

	if (variant === "sent") return null
	if (!showAvatar) return <span className="size-7 shrink-0" />

	return (
		<Avatar className={cn("size-7 shrink-0", className)}>
			<AvatarImage src={src} />
			<AvatarFallback className="bg-primary text-primary-foreground text-[10px]">
				{fallback}
			</AvatarFallback>
		</Avatar>
	)
}

type ChatBubbleMessageProps = {
	children?: React.ReactNode
	typing?: boolean
	className?: string
}

function ChatBubbleMessage({ children, typing = false, className }: ChatBubbleMessageProps) {
	const { variant, isFirst, isLast } = useChatBubble()

	if (typing) {
		return (
			<div className="bg-muted flex h-8 items-center rounded-2xl rounded-bl-md px-3">
				<div className="flex -space-x-2">
					<span className="bg-muted-foreground/70 animate-typing-dot-bounce size-1.5 rounded-full" />
					<span className="bg-muted-foreground/70 animate-typing-dot-bounce size-1.5 rounded-full [animation-delay:90ms]" />
					<span className="bg-muted-foreground/70 animate-typing-dot-bounce size-1.5 rounded-full [animation-delay:180ms]" />
				</div>
			</div>
		)
	}

	const borderRadius = getBubbleBorderRadius(variant, isFirst, isLast)

	return (
		<div
			className={cn(
				"px-3 py-1.5 text-xs leading-relaxed",
				variant === "sent" ? "bg-primary text-primary-foreground" : "bg-muted",
				borderRadius,
				className
			)}
		>
			{children}
		</div>
	)
}

type ChatBubbleTimestampProps = {
	children: React.ReactNode
	className?: string
}

function ChatBubbleTimestamp({ children, className }: ChatBubbleTimestampProps) {
	const { variant } = useChatBubble()

	return (
		<p
			className={cn(
				"text-muted-foreground text-[10px]",
				variant === "sent" && "text-right",
				className
			)}
		>
			{children}
		</p>
	)
}

type ChatTimeSeparatorProps = {
	children: React.ReactNode
	className?: string
}

function ChatTimeSeparator({ children, className }: ChatTimeSeparatorProps) {
	return (
		<div className={cn("flex items-center justify-center py-2", className)}>
			<span className="text-muted-foreground text-[10px]">{children}</span>
		</div>
	)
}

export const Chat = {
	List: ChatList,
	Bubble: ChatBubble,
	BubbleAvatar: ChatBubbleAvatar,
	BubbleMessage: ChatBubbleMessage,
	BubbleTimestamp: ChatBubbleTimestamp,
	TimeSeparator: ChatTimeSeparator,
}
