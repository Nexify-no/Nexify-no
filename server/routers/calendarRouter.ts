/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

// Extracted from server/routers.ts (app-layer feature router).
import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";

export const calendarRouter = router({
    getEvents: protectedProcedure
      .input(z.object({ month: z.number().min(1).max(12), year: z.number() }))
      .query(async ({ input }) => {
        // Return Norwegian + global events for the specified month
        const norwegianEvents = [
          { id: 1, title: "Nyttårsdag", description: "Feire nytt år og nye muligheter", eventDate: `${input.year}-01-01`, category: "norwegian", isRecurring: 1 },
          { id: 2, title: "Valentinsdag", description: "Kjærlighet og relasjoner", eventDate: `${input.year}-02-14`, category: "global", isRecurring: 1 },
          { id: 3, title: "Kvinnedagen", description: "Feire kvinner i arbeidslivet", eventDate: `${input.year}-03-08`, category: "global", isRecurring: 1 },
          { id: 4, title: "17. mai", description: "Norges nasjonaldag", eventDate: `${input.year}-05-17`, category: "norwegian", isRecurring: 1 },
          { id: 5, title: "Sankthansaften", description: "Midsommer feiring", eventDate: `${input.year}-06-23`, category: "norwegian", isRecurring: 1 },
          { id: 6, title: "Black Friday", description: "Salg og markedsføring", eventDate: `${input.year}-11-24`, category: "business", isRecurring: 1 },
          { id: 7, title: "Jul", description: "Julefeiring og tradisjon", eventDate: `${input.year}-12-24`, category: "norwegian", isRecurring: 1 },
        ];
        
        return norwegianEvents.filter(event => {
          const eventMonth = parseInt(event.eventDate.split('-')[1]);
          return eventMonth === input.month;
        });
      }),
      
    getUserSchedule: protectedProcedure.query(async () => {
      // Return empty for now - will be implemented with schedule feature
      return [];
    }),
  });