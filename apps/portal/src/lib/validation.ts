import { z } from "zod";
export const eventTypes = ["WEDDING", "BIRTHDAY", "GRADUATION", "GATHERING", "CORPORATE", "OTHER"] as const;
export const eventTypeSchema = z.enum(eventTypes);
export const colorValues = ["#17345f", "#337263", "#e46662", "#d7bfaa", "#958bd1", "#1d1d1d"] as const;
export const albumColorSchema = z.enum(colorValues);
export const albumStyles = ["MINIMALIST", "ROMANTIC", "MODERN", "CLASSIC"] as const;
export const albumStyleSchema = z.enum(albumStyles);
export function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) return false;
  const date = new Date(value + "T12:00:00.000Z");
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export const informationFields = {
  name: z.string().max(120, "Use até 120 caracteres."),
  eventDate: z.string().refine((v) => v === "" || isValidDate(v), "Informe uma data válida."),
  description: z.string().max(300, "A descrição pode ter até 300 caracteres."),
};
export const eventInformationSchema = z.object({
  ...informationFields,
  name: informationFields.name.trim().min(1, "Informe o nome do evento."),
  eventDate: informationFields.eventDate.refine((v) => !!v, "Informe a data do evento."),
  description: informationFields.description.optional(),
});
export const draftPatchSchema = z.object({
  type: eventTypeSchema.optional(),
  name: informationFields.name.optional(),
  eventDate: informationFields.eventDate.optional(),
  description: informationFields.description.optional(),
  albumColor: albumColorSchema.optional(),
}).strict();

const compactText = (limit: number, message: string) => z.string().trim().max(limit, message);

export const eventSettingsSchema = z.object({
  displayNames: compactText(120, "Use até 120 caracteres."),
  name: compactText(120, "Use até 120 caracteres.").min(1, "Informe o nome do álbum."),
  eventDate: z.string().refine(isValidDate, "Informe uma data válida."),
  eventTime: z.union([z.literal(""), z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Informe um horário válido.")]),
  venue: compactText(120, "Use até 120 caracteres."),
  albumColor: albumColorSchema,
  albumStyle: albumStyleSchema,
  welcomeMessage: compactText(300, "A mensagem pode ter até 300 caracteres."),
}).strict();
