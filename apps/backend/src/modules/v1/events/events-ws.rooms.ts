export function userRoom(userId: string): string {
	return `user:${userId}`
}

export function sessionRoom(roomId: string): string {
	return `session:${roomId}`
}

export function dmRoom(conversationId: string): string {
	return `dm:${conversationId}`
}
