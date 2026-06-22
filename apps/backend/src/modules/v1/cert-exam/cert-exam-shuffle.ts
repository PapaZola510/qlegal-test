import { createHash } from "node:crypto"

/** Deterministic PRNG (mulberry32) — stable shuffle per seed string. */
function mulberry32(seedUInt32: number): () => number {
	let a = seedUInt32 >>> 0
	return () => {
		a |= 0
		a = (a + 0x6d2b79f5) | 0
		let t = Math.imul(a ^ (a >>> 15), 1 | a)
		t ^= t + Math.imul(t ^ (t >>> 7), 61 | t)
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296
	}
}

function seedToUint32(seed: string): number {
	const h = createHash("sha256").update(seed, "utf8").digest()
	return h.readUInt32BE(0)
}

export function shuffleWithSeed<T>(items: readonly T[], seed: string): T[] {
	const rng = mulberry32(seedToUint32(seed))
	const arr = [...items]
	for (let i = arr.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1))
		const tmp = arr[i]!
		arr[i] = arr[j]!
		arr[j] = tmp
	}
	return arr
}

/**
 * `perm[slot]` = original choice index (0–3) shown at answer slot `slot`
 * (slot 0 → choice key "a", slot 1 → "b", …).
 */
export function choiceSlotToOriginalPermutation(attemptId: string, questionId: string): number[] {
	const perm = shuffleWithSeed([0, 1, 2, 3], `${attemptId}:${questionId}:choices`)
	return perm
}

export function correctDisplayedChoiceKey(
	attemptId: string,
	questionId: string,
	correctChoiceIndex: number
): string {
	const perm = choiceSlotToOriginalPermutation(attemptId, questionId)
	const slot = perm.indexOf(correctChoiceIndex)
	const keys = ["a", "b", "c", "d"] as const
	return keys[slot] ?? "a"
}
