import Image from "next/image";
import { cn } from "@/lib/utils";

type ContentPart =
  | { kind: "text"; text: string }
  | { kind: "image"; src: string; width: number; height: number; alt: string };

const IMAGE_TOKEN_RE =
  /\[\[image:([^\]|]+)\|(\d+)x(\d+)(?:\|([^\]]+))?\]\]/g;

function parseContent(content: string): ContentPart[] {
  const parts: ContentPart[] = [];
  let cursor = 0;

  for (const match of content.matchAll(IMAGE_TOKEN_RE)) {
    const index = match.index ?? 0;
    const text = content.slice(cursor, index).trim();
    if (text) parts.push({ kind: "text", text });

    const rawSrc = match[1].trim();
    const width = Number(match[2]);
    const height = Number(match[3]);
    const alt = match[4]?.trim() || "Question figure";
    if (rawSrc && width > 0 && height > 0) {
      parts.push({
        kind: "image",
        src: rawSrc.startsWith("/") ? rawSrc : `/${rawSrc}`,
        width,
        height,
        alt,
      });
    }

    cursor = index + match[0].length;
  }

  const tail = content.slice(cursor).trim();
  if (tail) parts.push({ kind: "text", text: tail });

  return parts.length > 0 ? parts : [{ kind: "text", text: content }];
}

export function QuestionContent({
  content,
  className,
  textClassName,
  imageClassName,
  imageSizes = "(max-width: 768px) 92vw, 760px",
}: {
  content: string;
  className?: string;
  textClassName?: string;
  imageClassName?: string;
  imageSizes?: string;
}) {
  const parts = parseContent(content);

  return (
    <div className={cn("space-y-4", className)}>
      {parts.map((part, index) => {
        if (part.kind === "text") {
          return (
            <p key={index} className={cn("whitespace-pre-line", textClassName)}>
              {part.text}
            </p>
          );
        }

        return (
          <figure
            key={index}
            className={cn(
              "overflow-hidden rounded-md border border-border bg-surface-2 p-2",
              imageClassName,
            )}
          >
            <Image
              src={part.src}
              alt={part.alt}
              width={part.width}
              height={part.height}
              sizes={imageSizes}
              className="h-auto max-h-[520px] w-full object-contain"
            />
          </figure>
        );
      })}
    </div>
  );
}
