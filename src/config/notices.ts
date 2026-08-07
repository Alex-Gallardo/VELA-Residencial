import { NoticeType, NotificationChannel, RoleName } from "@prisma/client";

export const noticeTypeLabels: Record<NoticeType, string> = {
  ALERTA_CRITICA: "Alerta crítica",
  AVISO_OPERATIVO: "Aviso operativo",
  COMUNICADO_ADMIN: "Comunicado administrativo",
  EVENTO_COMUNITARIO: "Evento comunitario",
};

export const notificationChannelLabels: Record<NotificationChannel, string> = {
  IN_APP: "En la aplicación",
  PUSH: "Notificación push",
  EMAIL: "Correo electrónico",
  SMS: "SMS",
};

export const noticeAudienceScopeLabels = {
  ALL: "Todo el residencial",
  ZONE: "Zona o sector",
  DWELLING: "Viviendas específicas",
  ROLE: "Roles específicos",
} as const;

export const audienceRoleLabels: Record<RoleName, string> = {
  ADMIN_GENERAL: "Administración general",
  OPERACIONES: "Operaciones",
  COMUNICACIONES: "Comunicaciones",
  FINANZAS: "Finanzas",
  MODERADOR: "Moderación",
  SEGURIDAD: "Seguridad",
  RESIDENTE: "Residentes",
  SOPORTE_SISTEMA: "Soporte de sistema",
};
