-- AlterTable
ALTER TABLE "talentbridge"."tenant_settings" ADD COLUMN "viotalk_api_base_url" TEXT NOT NULL DEFAULT '';
ALTER TABLE "talentbridge"."tenant_settings" ADD COLUMN "viotalk_partner_api_key" TEXT NOT NULL DEFAULT '';
ALTER TABLE "talentbridge"."tenant_settings" ADD COLUMN "viotalk_webhook_hmac_secret" TEXT NOT NULL DEFAULT '';
ALTER TABLE "talentbridge"."tenant_settings" ADD COLUMN "viotalk_company_id" TEXT NOT NULL DEFAULT '';
