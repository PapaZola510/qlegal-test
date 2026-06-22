declare module "react-signature-canvas" {
	import * as React from "react"

	type SignatureCanvasProps = {
		penColor?: string
		backgroundColor?: string
		minWidth?: number
		maxWidth?: number
		velocityFilterWeight?: number
		canvasProps?: React.CanvasHTMLAttributes<HTMLCanvasElement>
	}

	export default class SignatureCanvas extends React.Component<SignatureCanvasProps> {
		clear(): void
		isEmpty(): boolean
		toDataURL(type?: string): string
		getCanvas(): HTMLCanvasElement
	}
}
