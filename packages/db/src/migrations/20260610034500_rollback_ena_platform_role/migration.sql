UPDATE "users"
SET "platform_role" = 'admin',
	"updated_at" = now()
WHERE "platform_role" = 'ena';
