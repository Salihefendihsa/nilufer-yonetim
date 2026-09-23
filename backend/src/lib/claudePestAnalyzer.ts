import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { logger } from "./logger";
import type { PestAnalysis, PestAnalyzer } from "./pestDetection";

/**
 * Claude görsel analiziyle haşere tanıma (Bölüm J). Yalnızca ANTHROPIC_API_KEY
 * tanımlıyken lib/pestDetection.ts tarafından dinamik olarak yüklenir.
 *
 * Maliyet güvenliği:
 * - `maxRetries: 0`: SDK varsayılan olarak 429/5xx/ağ hatalarını 2 kez yeniden
 *   dener; burada hiç denemez — başarısız çağrı atlanır.
 * - Sunucu tarafı "refusal fallback" (reddi başka modelde yeniden çalıştırma)
 *   bilinçli olarak kullanılmaz: bu da ek ücretli ikinci bir çağrı olurdu.
 *   Ret gelirse fotoğraf analizsiz kalır.
 * - Basit bir sınıflandırma olduğu için `effort: "low"`; kısa JSON çıktı.
 */
const MODEL = "claude-opus-5";

const ResultSchema = z.object({
  pestType: z.string(),
  confidence: z.number(),
  description: z.string(),
});

const PROMPT = `Bu fotoğraf bir haşere ilaçlama firmasının saha personeli tarafından iş sırasında çekildi.
Fotoğrafta görülen haşereyi veya haşere izini (dışkı, yumurta, kabuk, kemirme izi, yuva vb.) belirle.

- pestType: Türkçe yaygın adı (ör. "Alman Hamamböceği", "Ev Faresi", "Firavun Karıncası", "Tahta Kurusu", "Sivrisinek"). Haşere veya iz görünmüyorsa "Tespit edilmedi".
- confidence: 0 ile 1 arasında güven skoru.
- description: En fazla iki cümlelik Türkçe açıklama — ne görüldüğü ve varsa ilaçlama için kısa bir not.`;

export function createClaudePestAnalyzer(): PestAnalyzer {
  const client = new Anthropic({ maxRetries: 0, timeout: 60_000 });

  return {
    model: MODEL,
    async analyze(image): Promise<PestAnalysis | null> {
      try {
        const response = await client.messages.parse({
          model: MODEL,
          max_tokens: 2048,
          output_config: { effort: "low", format: zodOutputFormat(ResultSchema) },
          messages: [
            {
              role: "user",
              content: [
                { type: "image", source: { type: "base64", media_type: image.mediaType, data: image.data.toString("base64") } },
                { type: "text", text: PROMPT },
              ],
            },
          ],
        });
        if (response.stop_reason === "refusal") {
          logger.warn({ category: response.stop_details?.category }, "Haşere analizi reddedildi, atlandı");
          return null;
        }
        return response.parsed_output ?? null;
      } catch (err) {
        // En özelden genele; hiçbiri yeniden denenmez (çağıran kayıt oluşturmaz).
        if (err instanceof Anthropic.RateLimitError) {
          logger.warn("Haşere analizi hız sınırına takıldı (429), atlandı");
        } else if (err instanceof Anthropic.APIConnectionError) {
          logger.warn({ err: err.message }, "Haşere analizi: Claude API'ye bağlanılamadı, atlandı");
        } else if (err instanceof Anthropic.APIError) {
          logger.warn({ status: err.status, err: err.message }, "Haşere analizi API hatası, atlandı");
        } else {
          throw err;
        }
        return null;
      }
    },
  };
}
