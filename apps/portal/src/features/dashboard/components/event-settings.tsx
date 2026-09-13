"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { colorValues } from "@/lib/event-constants";
import { requestJson } from "@/lib/client-api";
import { DashboardIcon } from "./dashboard-icon";
import styles from "./event-settings.module.css";

type AlbumStyle = "MINIMALIST" | "ROMANTIC" | "MODERN" | "CLASSIC";
type SettingsValues = {
  displayNames: string;
  name: string;
  eventDate: string;
  eventTime: string;
  venue: string;
  albumColor: (typeof colorValues)[number];
  albumStyle: AlbumStyle;
  welcomeMessage: string;
};
type EventSettingsProps = {
  event: {
    id: string;
    type: string | null;
    name: string | null;
    eventDate: string;
    displayNames: string | null;
    eventTime: string | null;
    venue: string | null;
    albumColor: (typeof colorValues)[number];
    albumStyle: AlbumStyle;
    welcomeMessage: string | null;
    coverUrl: string | null;
    logoUrl: string | null;
  };
};

const styleLabels: Record<AlbumStyle, string> = { MINIMALIST: "Minimalista", ROMANTIC: "Romântico", MODERN: "Moderno", CLASSIC: "Clássico" };
const colorNames = ["Azul-marinho", "Verde", "Coral", "Areia", "Lavanda", "Preto"];

function initialValues(event: EventSettingsProps["event"]): SettingsValues {
  return {
    displayNames: event.displayNames ?? "",
    name: event.name ?? "",
    eventDate: event.eventDate,
    eventTime: event.eventTime ?? "",
    venue: event.venue ?? "",
    albumColor: event.albumColor,
    albumStyle: event.albumStyle,
    welcomeMessage: event.welcomeMessage ?? "",
  };
}

export function EventSettings({ event }: EventSettingsProps) {
  const [savedValues, setSavedValues] = useState(() => initialValues(event));
  const [values, setValues] = useState(savedValues);
  const [savedCover, setSavedCover] = useState(event.coverUrl ?? "/images/optimized/party-480.webp");
  const [savedLogo, setSavedLogo] = useState(event.logoUrl);
  const [coverPreview, setCoverPreview] = useState(savedCover);
  const [logoPreview, setLogoPreview] = useState<string | null>(savedLogo);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [tab, setTab] = useState<"information" | "qrcode" | "finance">("information");
  const [device, setDevice] = useState<"phone" | "desktop">("phone");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const temporaryUrls = useRef(new Set<string>());
  const coverInput = useRef<HTMLInputElement>(null);
  const logoInput = useRef<HTMLInputElement>(null);
  const nameLabel = event.type === "WEDDING" ? "Nomes dos anfitriões" : "Nomes em destaque";

  useEffect(() => () => temporaryUrls.current.forEach((url) => URL.revokeObjectURL(url)), []);

  function updateValue<Key extends keyof SettingsValues>(key: Key, value: SettingsValues[Key]) {
    setValues((current) => ({ ...current, [key]: value }));
    setError("");
    setStatus("");
  }

  function discardPreview(value: string | null) {
    if (value?.startsWith("blob:")) {
      URL.revokeObjectURL(value);
      temporaryUrls.current.delete(value);
    }
  }

  function chooseImage(kind: "cover" | "logo", input: ChangeEvent<HTMLInputElement>) {
    const file = input.target.files?.[0];
    input.target.value = "";
    if (!file) return;
    const accepted = kind === "cover" ? ["image/jpeg", "image/png", "image/webp"] : ["image/png", "image/svg+xml"];
    const maxSize = kind === "cover" ? 5 * 1024 * 1024 : 2 * 1024 * 1024;
    const label = kind === "cover" ? "A capa" : "O logo";
    if (!accepted.includes(file.type) || file.size > maxSize) {
      setError(`${label} deve ser ${kind === "cover" ? "JPG, PNG ou WEBP de até 5 MB" : "PNG ou SVG de até 2 MB"}.`);
      return;
    }
    const preview = URL.createObjectURL(file);
    temporaryUrls.current.add(preview);
    if (kind === "cover") {
      discardPreview(coverPreview);
      setCoverPreview(preview);
      setCoverFile(file);
    } else {
      discardPreview(logoPreview);
      setLogoPreview(preview);
      setLogoFile(file);
    }
    setError("");
    setStatus("");
  }

  function cancel() {
    discardPreview(coverPreview);
    discardPreview(logoPreview);
    setValues(savedValues);
    setCoverPreview(savedCover);
    setLogoPreview(savedLogo);
    setCoverFile(null);
    setLogoFile(null);
    setError("");
    setStatus("Alterações não salvas foram descartadas.");
  }

  async function save(submit: FormEvent<HTMLFormElement>) {
    submit.preventDefault();
    if (busy) return;
    if (!values.name.trim() || !values.eventDate) {
      setError("Preencha o nome do álbum e a data do evento.");
      return;
    }
    setBusy(true);
    setError("");
    setStatus("");
    const form = new FormData();
    for (const [key, value] of Object.entries(values)) form.append(key, value);
    if (coverFile) form.append("cover", coverFile);
    if (logoFile) form.append("logo", logoFile);
    try {
      const result = await requestJson<{ coverUrl: string | null; logoUrl: string | null }>(`/api/eventos/${event.id}/configuracoes`, { method: "PUT", body: form });
      const newCover = result.coverUrl ?? coverPreview;
      const newLogo = result.logoUrl ?? logoPreview;
      setSavedValues(values);
      setSavedCover(newCover);
      setSavedLogo(newLogo);
      setCoverPreview(newCover);
      setLogoPreview(newLogo);
      setCoverFile(null);
      setLogoFile(null);
      setStatus("Alterações salvas.");
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const displayNames = values.displayNames.trim() || values.name.trim() || "Seu momento";
  const date = values.eventDate ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(`${values.eventDate}T12:00:00`)) : "Escolha uma data";
  const isRomantic = values.albumStyle === "ROMANTIC";

  return (
    <div className={styles.shell} style={{ "--album-color": values.albumColor } as React.CSSProperties}>
      <main className={styles.main}>
        <header className={styles.header}>
          <div className={styles.headerCopy}>
            <h1>Configurações do evento</h1>
            <p>Personalize seu álbum e deixe tudo pronto para compartilhar com seus convidados.</p>
          </div>
          <button className={styles.headerAction} type="submit" form="event-settings-form" disabled={busy || tab !== "information"}>
            <DashboardIcon name="check" />
            {busy ? "Salvando..." : "Salvar alterações"}
          </button>
        </header>

        <div className={styles.workspace}>
          <div className={styles.leftColumn}>
            <div className={styles.tabs} role="tablist" aria-label="Seções das configurações">
              <button type="button" role="tab" aria-selected={tab === "information"} className={tab === "information" ? styles.selectedTab : ""} onClick={() => setTab("information")}><DashboardIcon name="calendar" />Informações</button>
              <button type="button" role="tab" aria-selected={tab === "qrcode"} className={tab === "qrcode" ? styles.selectedTab : ""} onClick={() => setTab("qrcode")}><DashboardIcon name="qr" />QR Code</button>
              <button type="button" role="tab" aria-selected={tab === "finance"} className={tab === "finance" ? styles.selectedTab : ""} onClick={() => setTab("finance")}><DashboardIcon name="card" />Financeiro</button>
            </div>

            {tab === "information" ? <form id="event-settings-form" className={styles.formCard} onSubmit={save} noValidate aria-busy={busy}>
              <section className={styles.formSection} aria-labelledby="event-information-title">
                <SectionTitle icon="calendar" id="event-information-title" title="Sobre o evento" text="Essas informações serão exibidas para seus convidados." />
                <div className={styles.twoFields}>
                  <Field label={nameLabel} htmlFor="settings-displayNames"><input id="settings-displayNames" value={values.displayNames} maxLength={120} onChange={(input) => updateValue("displayNames", input.target.value)} placeholder={event.type === "WEDDING" ? "Ex.: Letícia & Rogério" : "Ex.: Anfitriões do evento"} /></Field>
                  <Field label="Nome do álbum" htmlFor="settings-name"><input id="settings-name" required value={values.name} maxLength={120} onChange={(input) => updateValue("name", input.target.value)} placeholder="Ex.: Nosso Grande Dia" /></Field>
                </div>
                <div className={styles.eventMeta}>
                  <Field label="Data do evento" htmlFor="settings-date" icon="calendar"><input id="settings-date" required type="date" value={values.eventDate} onChange={(input) => updateValue("eventDate", input.target.value)} /></Field>
                  <Field label="Horário (opcional)" htmlFor="settings-time"><input id="settings-time" type="time" value={values.eventTime} onChange={(input) => updateValue("eventTime", input.target.value)} /></Field>
                  <Field label="Local (opcional)" htmlFor="settings-venue" icon="pin"><input id="settings-venue" value={values.venue} maxLength={120} onChange={(input) => updateValue("venue", input.target.value)} placeholder="Ex.: Espaço Jardim das Flores" /></Field>
                </div>
              </section>

              <section className={styles.formSection} aria-labelledby="appearance-title">
                <SectionTitle icon="pencil" id="appearance-title" title="Identidade do álbum" text="Escolha a capa, as cores e o estilo que mais combinam com o seu evento." />
                <div className={styles.appearanceGrid}>
                  <div><span className={styles.fieldLabel}>Foto de capa</span><input ref={coverInput} className={styles.hiddenInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={(input) => chooseImage("cover", input)} /><button type="button" className={styles.coverPicker} onClick={() => coverInput.current?.click()}><img src={coverPreview} alt="Prévia da foto de capa" /><span><DashboardIcon name="camera" />Trocar foto</span></button></div>
                  <div className={styles.themeControls}><span className={styles.fieldLabel}>Cores do tema</span><div className={styles.colors}>{colorValues.map((color, index) => <button key={color} type="button" aria-label={`Selecionar cor ${colorNames[index]}`} aria-pressed={values.albumColor === color} className={values.albumColor === color ? styles.selectedColor : ""} style={{ backgroundColor: color }} onClick={() => updateValue("albumColor", color)}>{values.albumColor === color && <DashboardIcon name="check" />}</button>)}<button type="button" className={styles.customColor} disabled title="Cores personalizadas em breve" aria-label="Cores personalizadas em breve"><DashboardIcon name="plus" /></button></div><span className={styles.fieldLabel}>Estilo do álbum</span><div className={styles.styleChips}>{(Object.keys(styleLabels) as AlbumStyle[]).map((style) => <button key={style} type="button" aria-pressed={values.albumStyle === style} className={values.albumStyle === style ? styles.selectedStyle : ""} onClick={() => updateValue("albumStyle", style)}>{styleLabels[style]}</button>)}</div></div>
                  <div><span className={styles.fieldLabel}>Logo ou monograma <small>(opcional)</small></span><input ref={logoInput} className={styles.hiddenInput} type="file" accept="image/png,image/svg+xml" onChange={(input) => chooseImage("logo", input)} /><button type="button" className={styles.logoPicker} onClick={() => logoInput.current?.click()}>{logoPreview ? <img src={logoPreview} alt="Prévia do logo" /> : <DashboardIcon name="image" />}<strong>{logoPreview ? "Trocar imagem" : "Enviar imagem"}</strong><span>PNG ou SVG (máx. 2 MB)</span></button></div>
                </div>
              </section>

              <section className={styles.formSection} aria-labelledby="welcome-title">
                <SectionTitle icon="message" id="welcome-title" title="Mensagem de boas-vindas" text="Texto que será exibido na tela inicial para seus convidados." />
                <label className={styles.messageBox} htmlFor="settings-welcome"><textarea id="settings-welcome" aria-label="Mensagem de boas-vindas" value={values.welcomeMessage} maxLength={300} onChange={(input) => updateValue("welcomeMessage", input.target.value)} placeholder="Que bom te ver por aqui! Compartilhe os momentos deste dia especial conosco." /><span>{values.welcomeMessage.length}/300</span></label>
              </section>

              {error && <p className={styles.error} role="alert">{error}</p>}
              <p className={styles.status} role="status">{status}</p>
              <footer className={styles.formFooter}><button className={styles.cancel} type="button" disabled={busy} onClick={cancel}>Cancelar</button><button className={styles.save} type="submit" disabled={busy}>{busy ? "Salvando..." : "Salvar alterações"}</button></footer>
            </form> : <UnavailableTab tab={tab} />}
          </div>

          <aside className={styles.previewCard} aria-label="Pré-visualização do álbum">
            <div className={styles.previewHeader}><div className={styles.previewHeading}><DashboardIcon name="eye" /><div><h2>Pré-visualização</h2><p>Veja como ficará para seus convidados.</p></div></div><div className={styles.deviceControls}><button type="button" aria-label="Visualização em celular" aria-pressed={device === "phone"} onClick={() => setDevice("phone")}><DashboardIcon name="phone" /></button><button type="button" aria-label="Visualização em computador" aria-pressed={device === "desktop"} onClick={() => setDevice("desktop")}><DashboardIcon name="desktop" /></button></div></div>
            <div className={`${styles.deviceFrame} ${device === "desktop" ? styles.desktopFrame : ""} ${isRomantic ? styles.romanticPreview : ""}`}>
              <div className={styles.notch} aria-hidden="true" />
              <div className={styles.albumPreview}>
                <div className={styles.previewNav}><strong>{logoPreview ? <img src={logoPreview} alt="Logo do álbum" /> : <>♡ <span>Nosso Álbum</span></>}</strong><DashboardIcon name="menu" /></div>
                <img className={styles.previewCover} src={coverPreview} alt="" />
                <div className={styles.previewContent}><h3>{displayNames}</h3><time>{date}{values.eventTime ? ` · ${values.eventTime}` : ""}</time><b aria-hidden="true">♡</b><p>{values.welcomeMessage.trim() || "Que bom te ver por aqui! Compartilhe os momentos deste dia especial conosco. 💚"}</p><button type="button" disabled><DashboardIcon name="camera" />Enviar fotos</button><button type="button" className={styles.secondaryPreview} disabled><DashboardIcon name="image" />Ver galeria</button>{isRomantic && <em>Juntos para<br />sempre ♡</em>}</div>
              </div>
            </div>
            <div className={styles.dots} aria-hidden="true"><i /><i /></div>
            <button className={styles.openPreview} type="button" disabled title="A prévia pública será liberada com os convites."><DashboardIcon name="external" /><span><strong>Acesse em uma nova aba</strong><small>para ver em tamanho real</small></span></button>
          </aside>
        </div>
      </main>
    </div>
  );
}

function Field({ label, htmlFor, icon, children }: { label: string; htmlFor: string; icon?: "calendar" | "pin"; children: React.ReactNode }) {
  return <label className={`${styles.field} ${icon ? styles.withIcon : ""}`} htmlFor={htmlFor}><span>{label}</span>{children}{icon && <DashboardIcon name={icon} />}</label>;
}

function SectionTitle({ icon, id, title, text }: { icon: "calendar" | "pencil" | "message"; id: string; title: string; text: string }) {
  return <div className={styles.sectionTitle}><DashboardIcon name={icon} /><div><h2 id={id}>{title}</h2><p>{text}</p></div></div>;
}

function UnavailableTab({ tab }: { tab: "qrcode" | "finance" }) {
  const isQr = tab === "qrcode";
  return <section className={styles.unavailable}><DashboardIcon name={isQr ? "qr" : "card"} /><h2>{isQr ? "QRCode" : "Financeiro"}</h2><p>{isQr ? "A personalização do QR Code será liberada quando os convites estiverem disponíveis." : "As configurações financeiras serão adicionadas em uma próxima etapa."}</p><span>Em breve</span></section>;
}
