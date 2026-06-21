export function normalizeClientName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeClientNumber(value: string) {
  return value.trim().toLocaleUpperCase("pt-BR").replace(/\s+/g, "-");
}
