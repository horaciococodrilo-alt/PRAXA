import { handlePrivacyWebhook } from '@/modules/integrations/tiendanube/privacy';

/**
 * Webhook de privacidad `store_redact` de Tiendanube. Sin sesión: lo autentica la firma HMAC del
 * cuerpo crudo, verificada antes de parsear. El tipo de evento sale de esta URL (M16e §4).
 */
export async function POST(request: Request) {
  return handlePrivacyWebhook('store_redact', request);
}
