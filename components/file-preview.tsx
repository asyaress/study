"use client";

import { Download } from "lucide-react";
import { useEffect, useRef, useState } from "react";

function previewKind(name: string, type: string) {
  const lower = name.toLowerCase();
  if (type.startsWith("image/") || /\.(png|jpe?g|gif|webp)$/.test(lower)) return "image" as const;
  if (type === "application/pdf" || lower.endsWith(".pdf")) return "pdf" as const;
  if (lower.endsWith(".pptx")) return "pptx" as const;
  return "file" as const;
}

function PptxSlides({ href, name }: { href: string; name: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const node = host.current;
    if (!node) return;
    let cancelled = false;
    let previewer: { preview: (file: ArrayBuffer) => Promise<unknown>; destroy: () => void } | null = null;
    (async () => {
      const response = await fetch(href);
      if (!response.ok) throw new Error("File tidak bisa dibuka.");
      const buffer = await response.arrayBuffer();
      const { init } = await import("pptx-preview");
      if (cancelled) return;
      const width = Math.max(280, Math.min(node.clientWidth || 720, 960));
      previewer = init(node, {
        width,
        height: Math.round(width * 0.56),
        mode: "list",
      });
      await previewer.preview(buffer);
    })().catch(() => {
      if (!cancelled) setFailed(true);
    });
    return () => {
      cancelled = true;
      try {
        previewer?.destroy();
      } catch {
        node.replaceChildren();
      }
    };
  }, [href]);

  if (failed) {
    return (
      <a className="study-download" href={href}>
        <Download size={18} /> {name}
      </a>
    );
  }
  return <div className="pptx-preview" ref={host} />;
}

export function FilePreview({ href, name }: { href: string; name: string }) {
  const [url, setUrl] = useState("");
  const [kind, setKind] = useState<"image" | "pdf" | "pptx" | "file">("file");

  useEffect(() => {
    let objectUrl = "";
    let cancelled = false;
    fetch(href)
      .then(async (response) => {
        if (!response.ok) return null;
        const blob = await response.blob();
        return { blob, type: blob.type };
      })
      .then((result) => {
        if (!result || cancelled) return;
        const nextKind = previewKind(name, result.type);
        if (nextKind === "pptx") {
          setKind("pptx");
          return;
        }
        objectUrl = URL.createObjectURL(result.blob);
        setKind(nextKind);
        setUrl(objectUrl);
      })
      .catch(() => setKind(previewKind(name, "")));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [href, name]);

  if (kind === "pptx") return <PptxSlides href={href} name={name} />;
  if (kind === "image" && url) return <img src={url} alt={name} />;
  if (kind === "pdf" && url) return <iframe title={name} src={url} />;
  return (
    <a className="study-download" href={href}>
      <Download size={18} /> {name}
    </a>
  );
}
