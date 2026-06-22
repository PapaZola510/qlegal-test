import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pyPath =
	process.env.LEGACY_QUESTION_BANK_PATH ?? "C:/quanby-legal-v2/backend/question_bank.py"
const outPath = path.join(__dirname, "../src/exam/atty-questions.json")

const s = fs.readFileSync(pyPath, "utf8")
const startMarker = "ATTORNEY_QUESTIONS = ["
const m = s.indexOf(startMarker)
if (m < 0) throw new Error(`Missing ${startMarker} in ${pyPath}`)
const startIdx = m + startMarker.length - 1 // points at '['

/** Match outer `[` … `]` ignoring brackets inside strings */
function sliceTopLevelArray(src, openBracketIdx) {
	let depth = 0
	let inString = false
	let escape = false
	for (let i = openBracketIdx; i < src.length; i++) {
		const c = src[i]
		if (inString) {
			if (escape) escape = false
			else if (c === "\\") escape = true
			else if (c === '"') inString = false
			continue
		}
		if (c === '"') {
			inString = true
			continue
		}
		if (c === "[") depth++
		if (c === "]") {
			depth--
			if (depth === 0) return src.slice(openBracketIdx, i + 1)
		}
	}
	throw new Error("Unclosed ATTORNEY_QUESTIONS array")
}

let raw = sliceTopLevelArray(s, startIdx)
raw = raw
	.split("\n")
	.filter(line => !/^\s*#/.test(line))
	.join("\n")
// Python allows trailing commas before ] — JSON does not
raw = raw.replace(/,(\s*])/g, "$1")
let data
try {
	data = JSON.parse(raw)
} catch (e) {
	fs.writeFileSync(outPath + ".debug.txt", raw)
	throw e
}
fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, JSON.stringify(data))
console.log(`Wrote ${data.length} questions to ${outPath}`)
