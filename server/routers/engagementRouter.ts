/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

// Extracted from server/routers.ts (app-layer feature router).
import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";

export const engagementRouter = router({
    generateResponse: protectedProcedure
      .input(z.object({
        originalPost: z.string().min(1),
        responseType: z.enum(["supportive", "insightful", "question", "appreciation"]),
      }))
      .mutation(async ({ ctx, input }) => {
        const { getUserSubscription } = await import("../db");
        const { invokeLLM } = await import("../_core/llm");
        
        // Check Pro subscription
        const subscription = await getUserSubscription(ctx.user.id);
        if (!subscription || subscription.status !== "active") {
          throw new Error("Engasjement-Hjelper krever Pro-abonnement");
        }
        
        // Define response instructions
        const responseInstructions = {
          supportive: "Skriv et støttende svar som viser enighet og oppmuntring. Vær varm og positiv.",
          insightful: "Skriv et innsiktsfullt svar som legger til nytt perspektiv eller erfaring. Vær gjennomtenkt og verdifull.",
          question: "Skriv et svar med et gjennomtenkt oppfølgingsspørsmål som starter en dypere samtale.",
          appreciation: "Skriv et takknemlig svar som viser at du setter pris på innholdet. Vær oppriktig og spesifikk.",
        };
        
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `Du er en ekspert på profesjonelt engasjement i sosiale medier. ${responseInstructions[input.responseType]} Hold svaret kort (2-4 setninger) og profesjonelt. Skriv på norsk.`
            },
            {
              role: "user",
              content: `Innlegg:

${input.originalPost}

Skriv et ${input.responseType} svar.`
            }
          ]
        });
        
        const generatedResponse = response.choices[0]?.message?.content;
        if (typeof generatedResponse !== 'string') {
          throw new Error("Kunne ikke generere svar");
        }
        
        return { response: generatedResponse };
      }),
  });