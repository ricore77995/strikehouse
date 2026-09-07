import { useQuery } from "@tanstack/react-query";

interface YogoClassTypeImage {
  filename: string | null;
}

interface YogoClassTypeRaw {
  id: number;
  name: string;
  description: string | null;
  color: string | null;
  archived: number;
  image?: YogoClassTypeImage | null;
}

export interface ClassType {
  id: number;
  name: string;
  /** Lead lines of the YOGO description, with the shared arrival notice removed. */
  lines: string[];
  /** Colour the gym assigned in YOGO. Unused for now — see the plan's open decision. */
  color: string | null;
  /** Photo set in YOGO, when there is one. null falls back to a local photo. */
  imageUrl: string | null;
}

const API_BASE = "/api/yogo";

/**
 * Every class description ends with the same arrival notice. It belongs in the
 * "first class" block once, not repeated on each of five modality cards.
 */
const ARRIVAL_NOTICE = /chega\s+\d+\s+minutos?\s+antes|a aula come[çc]a na hora/i;

export function descriptionLines(description: string | null | undefined): string[] {
  return (description || "")
    .replace(/\r\n/g, "\n")
    .split(/\n+/)
    .map((line) => line.replace(/^[\p{Extended_Pictographic}️‍\s•\-–—]+/u, "").trim())
    .filter((line) => line.length > 0 && !ARRIVAL_NOTICE.test(line));
}

function buildImageUrl(image: YogoClassTypeImage | null | undefined): string | null {
  if (!image?.filename) return null;
  return `https://yogo.imgix.net/${image.filename}?w=800&h=800&fit=crop&auto=format`;
}

async function fetchClassTypes(): Promise<ClassType[]> {
  // The image only comes back when asked for, which is why it looked absent at first.
  const res = await fetch(`${API_BASE}/class-types?populate[]=image`, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error(`YOGO class-types: ${res.status}`);

  const raw: YogoClassTypeRaw[] = await res.json();
  return raw
    .filter((type) => !type.archived)
    .map((type) => ({
      id: type.id,
      name: type.name,
      lines: descriptionLines(type.description),
      color: type.color ?? null,
      imageUrl: buildImageUrl(type.image),
    }));
}

export function useYogoClassTypes() {
  return useQuery<ClassType[]>({
    queryKey: ["yogo-class-types"],
    queryFn: fetchClassTypes,
    staleTime: 10 * 60 * 1000,
    retry: 2,
  });
}
