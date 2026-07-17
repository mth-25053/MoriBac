export class HeaderNormalizer {
  static normalize(value: unknown) {
    return String(value ?? "")
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .trim()
      .toUpperCase()
      .replace(/[^\p{L}\p{N}]/gu, "");
  }
}

export const normalizeHeader = HeaderNormalizer.normalize;