import { Check, Copy, Share2, X } from "lucide-react";
import { useState } from "react";
import type { Language } from "../../domain/models";
import { translate } from "../../i18n";

interface ShareLinkPanelProps {
  url: string;
  title: string;
  language: Language;
  onClose(): void;
}

export function ShareLinkPanel({ url, title, language, onClose }: ShareLinkPanelProps) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setFailed(false);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setFailed(true);
    }
  };

  const share = async () => {
    if (!navigator.share) { await copy(); return; }
    try {
      await navigator.share({ title, url });
      setFailed(false);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setFailed(true);
    }
  };

  return <div className="share-link-panel">
    <div className="share-link-heading"><div><strong>{t("linkReady")}</strong><span>{t("linkReadyCopy")}</span></div><button aria-label={t("close")} onClick={onClose}><X size={17} /></button></div>
    <input aria-label={t("participantLink")} readOnly value={url} onFocus={(event) => event.currentTarget.select()} />
    <div className="share-link-actions"><button className="share-link-primary" onClick={() => { void share(); }}><Share2 size={18} /> {t("shareLink")}</button><button onClick={() => { void copy(); }}>{copied ? <Check size={18} /> : <Copy size={18} />} {copied ? t("linkCopied") : t("copyLink")}</button></div>
    {failed && <p>{t("linkActionFailed")}</p>}
  </div>;
}
