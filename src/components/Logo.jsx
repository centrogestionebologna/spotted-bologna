/*
 * Marchio di Spotted Bologna: cuore rosso, le due parole del nome e
 * "OFFICIAL". Sta in un solo posto cosi' la schermata di caricamento e
 * l'intestazione (quindi anche la pagina di accesso e il feed) mostrano
 * sempre lo stesso logo.
 */
function Logo({ variant = "splash" }) {
  return (
    <span className={`spotted-logo spotted-logo--${variant}`}>
      <span
        className="spotted-logo-heart"
        aria-hidden="true"
      >
        ♥
      </span>

      <span className="spotted-logo-word">
        SPOTTED
      </span>

      <span className="spotted-logo-word">
        BOLOGNA
      </span>

      <span className="spotted-logo-official">
        OFFICIAL
      </span>
    </span>
  );
}

export default Logo;
