export function About() {
  return (
    <section className="article">
      <div className="container">
        <div className="kicker">o mně</div>
        <h1>Ahoj, jsem Pavel.</h1>
        <div className="article-body" style={{ marginTop: 24 }}>
          <p>
            Vývojář a&nbsp;tvůrce. Tento blog je moje místo na&nbsp;poznámky o&nbsp;programování,
            designu a&nbsp;věcech, které mě zrovna baví.
          </p>
          <p>
            Celý web běží na&nbsp;<strong>vlastním headless CMS</strong> (TheCMS) — obsah píšu
            v&nbsp;administraci a&nbsp;tahle stránka ho načítá živě přes API.
          </p>
          <p>
            Napsat mi můžeš přes <a className="text-link" href="/contact">kontaktní formulář</a>.
          </p>
        </div>
      </div>
    </section>
  );
}
