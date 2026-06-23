/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { z } from "zod";
import { protectedProcedure, adminProcedure, router } from "../_core/trpc";
import { notifyOwner } from "../_core/notification";
import { getDb } from "../db";
import { supportTickets, supportTicketReplies } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

export const supportRouter = router({
  /**
   * Create a new support ticket
   */
  createTicket: protectedProcedure
    .input(
      z.object({
        subject: z.string().min(5).max(255),
        description: z.string().min(10),
        category: z.enum(["billing", "technical", "feature_request", "bug_report", "account", "other"]),
        priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection failed");

      await db.insert(supportTickets).values({
        userId: ctx.user.id,
        subject: input.subject,
        description: input.description,
        category: input.category,
        priority: input.priority || "medium",
        status: "open",
      });

      // Notify owner of new ticket
      await notifyOwner({
        title: "New Support Ticket",
        content: `${ctx.user.name} submitted a ${input.priority || "medium"} priority ${input.category} ticket: "${input.subject}"`,
      });

      return { success: true };
    }),

  /**
   * Get user's support tickets
   */
  getMyTickets: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database connection failed");
    return await db
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.userId, ctx.user.id))
      .orderBy((t) => t.createdAt);
  }),

  /**
   * Get ticket details with replies
   */
  getTicketDetails: protectedProcedure
    .input(z.object({ ticketId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection failed");

      const ticket = await db
        .select()
        .from(supportTickets)
        .where(and(eq(supportTickets.id, input.ticketId), eq(supportTickets.userId, ctx.user.id)))
        .limit(1);

      if (!ticket || ticket.length === 0) {
        throw new Error("Ticket not found");
      }

      const replies = await db
        .select()
        .from(supportTicketReplies)
        .where(eq(supportTicketReplies.ticketId, input.ticketId));

      return { ticket: ticket[0], replies };
    }),

  /**
   * Add reply to ticket
   */
  addReply: protectedProcedure
    .input(
      z.object({
        ticketId: z.number(),
        message: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection failed");

      // Verify user owns the ticket
      const ticket = await db
        .select()
        .from(supportTickets)
        .where(and(eq(supportTickets.id, input.ticketId), eq(supportTickets.userId, ctx.user.id)))
        .limit(1);

      if (!ticket || ticket.length === 0) {
        throw new Error("Ticket not found");
      }

      await db.insert(supportTicketReplies).values({
        ticketId: input.ticketId,
        userId: ctx.user.id,
        isAdminReply: 0,
        message: input.message,
      });

      // Update ticket updated_at
      await db
        .update(supportTickets)
        .set({ updatedAt: new Date() })
        .where(eq(supportTickets.id, input.ticketId));

      return { success: true };
    }),

  /**
   * Admin: Get all support tickets
   */
  getAllTickets: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database connection failed");
    return await db.select().from(supportTickets).orderBy((t) => t.createdAt);
  }),

  /**
   * Admin: Get ticket with user info
   */
  getTicketWithUser: adminProcedure
    .input(z.object({ ticketId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection failed");

      const ticket = await db
        .select()
        .from(supportTickets)
        .where(eq(supportTickets.id, input.ticketId))
        .limit(1);

      if (!ticket || ticket.length === 0) {
        throw new Error("Ticket not found");
      }

      const replies = await db
        .select()
        .from(supportTicketReplies)
        .where(eq(supportTicketReplies.ticketId, input.ticketId));

      return { ticket: ticket[0], replies };
    }),

  /**
   * Admin: Update ticket status
   */
  updateTicketStatus: adminProcedure
    .input(
      z.object({
        ticketId: z.number(),
        status: z.enum(["open", "in_progress", "waiting_customer", "resolved", "closed"]),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection failed");
      await db
        .update(supportTickets)
        .set({ status: input.status, updatedAt: new Date() })
        .where(eq(supportTickets.id, input.ticketId));

      return { success: true };
    }),

  /**
   * Admin: Add admin reply to ticket
   */
  addAdminReply: adminProcedure
    .input(
      z.object({
        ticketId: z.number(),
        message: z.string().min(1),
        resolveTicket: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection failed");

      await db.insert(supportTicketReplies).values({
        ticketId: input.ticketId,
        userId: ctx.user.id,
        isAdminReply: 1,
        message: input.message,
      });

      // Update ticket
      const updateData: any = { updatedAt: new Date() };
      if (input.resolveTicket) {
        updateData.status = "resolved";
        updateData.resolution = input.message;
        updateData.resolvedAt = new Date();
        updateData.assignedTo = ctx.user.id;
      }

      await db.update(supportTickets).set(updateData).where(eq(supportTickets.id, input.ticketId));

      return { success: true };
    }),

  /**
   * Admin: Assign ticket to admin
   */
  assignTicket: adminProcedure
    .input(z.object({ ticketId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection failed");
      await db
        .update(supportTickets)
        .set({ assignedTo: ctx.user.id, status: "in_progress", updatedAt: new Date() })
        .where(eq(supportTickets.id, input.ticketId));

      return { success: true };
    }),

  /**
   * Admin: Get ticket statistics
   */
  getStats: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database connection failed");
    const tickets = await db.select().from(supportTickets);

    return {
      total: tickets.length,
      open: tickets.filter((t: any) => t.status === "open").length,
      inProgress: tickets.filter((t: any) => t.status === "in_progress").length,
      resolved: tickets.filter((t: any) => t.status === "resolved").length,
      closed: tickets.filter((t: any) => t.status === "closed").length,
      urgent: tickets.filter((t: any) => t.priority === "urgent").length,
    };
  }),
});