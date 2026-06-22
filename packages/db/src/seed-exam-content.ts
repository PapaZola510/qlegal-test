/* eslint-disable no-console */
import "dotenv/config"

import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import { examQuestionRevisions, examQuestions, examVersions, schema } from "./schema.js"

type LegacyQuestion = {
	id: string
	question: string
	choices: [string, string, string, string]
	answer: string
	category: string
}

const __dirname = dirname(fileURLToPath(import.meta.url))

function answerLetterToIndex(answer: string): number {
	const m = answer
		.trim()
		.toUpperCase()
		.match(/^([A-D])/)
	const letter = m?.[1]
	if (!letter) throw new Error(`Invalid answer letter: ${answer}`)
	return letter.charCodeAt(0) - "A".charCodeAt(0)
}

function stripChoicePrefix(text: string): string {
	return text.replace(/^[A-D]\.\s*/, "")
}

async function main() {
	const connectionString = process.env.DATABASE_URL
	if (!connectionString) throw new Error("DATABASE_URL is required")

	const jsonPath = join(__dirname, "exam", "atty-questions.json")
	const bank = JSON.parse(readFileSync(jsonPath, "utf8")) as LegacyQuestion[]

	const pool = new Pool({ connectionString })
	const db = drizzle({ client: pool, schema })

	const title = "Philippine ENP Certification Exam"
	const sectionCount = 5
	const perSection = 10
	const durationMinutes = 60
	const passingScorePct = 70

	await db.transaction(async tx => {
		const [existing] = await tx
			.select()
			.from(examVersions)
			.where(eq(examVersions.title, title))
			.limit(1)
		if (existing) {
			console.log("Exam version already seeded:", existing.id)
			return
		}

		const [version] = await tx
			.insert(examVersions)
			.values({
				title,
				durationMinutes,
				passingScorePct,
				sectionCount,
				questionsPerSection: perSection,
				isActive: true,
			})
			.returning()

		if (!version) throw new Error("Failed to insert exam version")

		for (let i = 0; i < bank.length; i++) {
			const q = bank[i]!
			const sectionIndex = Math.floor(i / perSection) + 1
			const displayOrder = (i % perSection) + 1

			const [row] = await tx
				.insert(examQuestions)
				.values({
					examVersionId: version.id,
					legacyStableId: q.id,
					sectionIndex,
					displayOrder,
				})
				.returning()

			if (!row) throw new Error(`Failed to insert question ${q.id}`)

			const choicesBody: [string, string, string, string] = [
				stripChoicePrefix(q.choices[0]),
				stripChoicePrefix(q.choices[1]),
				stripChoicePrefix(q.choices[2]),
				stripChoicePrefix(q.choices[3]),
			]

			await tx.insert(examQuestionRevisions).values({
				questionId: row.id,
				promptText: q.question,
				choicesJson: choicesBody,
				correctChoiceIndex: answerLetterToIndex(q.answer),
			})
		}

		console.log(`Seeded exam version ${version.id} with ${bank.length} questions.`)
	})

	await pool.end()
}

void main().catch(err => {
	console.error(err)
	process.exitCode = 1
})
