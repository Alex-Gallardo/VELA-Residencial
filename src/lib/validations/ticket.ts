import { TicketCategory, TicketStatus } from "@prisma/client";
import { z } from "zod";

export const createTicketSchema = z.object({
  category: z.nativeEnum(TicketCategory),
  title: z.string().trim().min(5).max(100),
  description: z.string().trim().min(10).max(2000),
  locationText: z.string().trim().max(160).optional(),
  dwellingId: z.string().trim().min(1),
});

export const ticketCommentSchema = z.object({
  ticketId: z.string().min(1),
  body: z.string().trim().min(2).max(2000),
});

export const assignTicketSchema = z.object({
  ticketId: z.string().min(1),
  assigneeId: z.string().min(1),
});

export const transitionTicketSchema = z.object({
  ticketId: z.string().min(1),
  toStatus: z.nativeEnum(TicketStatus),
  note: z.string().trim().max(500).optional(),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
