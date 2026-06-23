"use client"

import * as React from "react"
import { Spinner } from "@/core/components/ui/spinner"
import { cn } from "@/core/lib/utils"

interface PageDim {
	originalWidth: number
	originalHeight: number
	renderedWidth: number
	renderedHeight: number
}

interface PlacedField {
	signerEmail: string
	pageIndex: number
	x: number
	y: number
	width: number
	height: number
}

interface SignerDisplayInfo {
	displayName: string
	roleSuffix: string
	color: "attorney" | "signee"
}

interface PdfViewerProps {
	pdfUrl: string
	containerWidth: number
	selectedSignerEmail: string | null
	plottedFields: PlacedField[]
	signerInfoByEmail: Map<string, SignerDisplayInfo>
	onDocumentLoad: (numPages: number) => void
	onPageClick: (pageNumber: number, e: React.MouseEvent<HTMLDivElement>) => void
	onPageLoad: (pageNumber: number, dim: PageDim) => void
	onRemoveField: (globalIndex: number) => void
}

export function PdfViewer({
	pdfUrl,
	containerWidth,
	selectedSignerEmail,
	plottedFields,
	signerInfoByEmail,
	onDocumentLoad,
	onPageClick,
	onPageLoad,
	onRemoveField,
}: PdfViewerProps) {
	const [numPages, setNumPages] = React.useState(0)
	const pageDimensionsRef = React.useRef<Record<number, PageDim>>({})
	const surfaceRef = React.useRef<HTMLDivElement>(null)

	const [mounted, setMounted] = React.useState(false)
	const [ReactPdf, setReactPdf] = React.useState<{
		Document: React.ComponentType<any>
		Page: React.ComponentType<any>
	} | null>(null)
	const [, setPdfjs] = React.useState<{
		version: string
		GlobalWorkerOptions: { workerSrc: string }
	} | null>(null)

	React.useEffect(() => {
		setMounted(true)
		let cancelled = false
		import("react-pdf")
			.then(mod => {
				if (cancelled) return
				const pdfjs = mod.pdfjs as {
					version: string
					GlobalWorkerOptions: { workerSrc: string }
				}
				pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
				setPdfjs(pdfjs)
				setReactPdf({
					Document: mod.Document as React.ComponentType<any>,
					Page: mod.Page as React.ComponentType<any>,
				})
			})
			.catch(err => {
				if (!cancelled) {
					console.error("Failed to load react-pdf:", err)
				}
			})
		return () => {
			cancelled = true
		}
	}, [])

	const handleLoadSuccess = React.useCallback(
		(pdf: { numPages: number }) => {
			setNumPages(pdf.numPages)
			onDocumentLoad(pdf.numPages)
		},
		[onDocumentLoad]
	)

	const handlePageLoadSuccess = React.useCallback(
		(pageNumber: number, page: { originalWidth: number; originalHeight: number; width: number; height: number }) => {
			const dim: PageDim = {
				originalWidth: page.originalWidth,
				originalHeight: page.originalHeight,
				renderedWidth: page.width,
				renderedHeight: page.height,
			}
			pageDimensionsRef.current[pageNumber] = dim
			onPageLoad(pageNumber, dim)
		},
		[onPageLoad]
	)

	const docOptions = React.useMemo(() => ({ withCredentials: true }), [])

	const getFieldStyle = React.useCallback((field: PlacedField, pageNumber: number) => {
		const dim = pageDimensionsRef.current[pageNumber]
		if (!dim) return undefined
		const scaleX = dim.originalWidth / dim.renderedWidth
		const scaleY = dim.originalHeight / dim.renderedHeight
		return {
			left: field.x / scaleX,
			top: (dim.originalHeight - field.y - field.height) / scaleY,
			width: field.width / scaleX,
			height: field.height / scaleY,
		} as React.CSSProperties
	}, [])

	if (!mounted || !ReactPdf) {
		return (
			<div className="flex items-center justify-center h-full">
				<Spinner />
			</div>
		)
	}

	const { Document, Page } = ReactPdf

	return (
		<div ref={surfaceRef}>
			<Document
				file={pdfUrl}
				onLoadSuccess={handleLoadSuccess}
				options={docOptions}
				loading={
					<div className="flex items-center justify-center p-8">
						<Spinner />
					</div>
				}
				error={
					<div className="flex items-center justify-center p-8 text-xs text-red-500">
						Failed to load PDF.
					</div>
				}
			>
				{Array.from({ length: numPages }, (_, i) => {
					const pageNumber = i + 1
					return (
						<div
							key={pageNumber}
							className={cn(
								"relative mx-auto mb-4",
								selectedSignerEmail ? "cursor-crosshair" : "cursor-default"
							)}
							style={{ width: containerWidth }}
							onClick={e => onPageClick(pageNumber, e)}
						>
							<Page
								pageNumber={pageNumber}
								width={containerWidth}
								renderTextLayer={false}
								renderAnnotationLayer={false}
								onLoadSuccess={(page: any) => handlePageLoadSuccess(pageNumber, page)}
								className="[&>canvas]:!rounded-lg [&>canvas]:!shadow-lg"
							/>
							{plottedFields
								.filter(f => f.pageIndex === pageNumber - 1)
								.map((field, fi) => {
									const info = signerInfoByEmail.get(field.signerEmail)
									const isAttorney = info?.color === "attorney"
									const style = getFieldStyle(field, pageNumber)
									if (!style) return null

									return (
										<div
											key={`${field.signerEmail}-${field.pageIndex}-${field.x}-${field.y}`}
											className={cn(
												"absolute flex items-center justify-center rounded border-2",
												isAttorney
													? "border-blue-500 bg-blue-500/15"
													: "border-emerald-500 bg-emerald-500/15"
											)}
											style={{
												...style,
												pointerEvents: "auto",
											}}
										>
											<button
												type="button"
												className="absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow hover:bg-red-600"
												onClick={e => {
													e.stopPropagation()
													const globalIdx = plottedFields.indexOf(field)
													if (globalIdx !== -1) onRemoveField(globalIdx)
												}}
												title="Remove field"
											>
												&times;
											</button>
											<span
												className={cn(
													"px-1 text-[10px] font-semibold leading-tight",
													isAttorney
														? "text-blue-700 dark:text-blue-300"
														: "text-emerald-700 dark:text-emerald-300"
												)}
											>
												{info
													? `${info.displayName} — ${info.roleSuffix}`
													: field.signerEmail}
											</span>
										</div>
									)
								})}
						</div>
					)
				})}
			</Document>
		</div>
	)
}
