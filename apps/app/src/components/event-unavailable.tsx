import { Heart } from "lucide-react";

export function EventUnavailable() {
  return (
    <main className="app-stage">
      <section className="mobile-shell unavailable-screen">
        <Heart aria-hidden="true" className="unavailable-icon" />
        <p className="monogram">L♡R</p>
        <h1>Evento indisponível</h1>
        <p>
          O álbum deste casamento não foi encontrado ou ainda não está ativo.
        </p>
      </section>
    </main>
  );
}
