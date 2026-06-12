/** Shown when no real API config is present yet. */
export function Setup() {
  return (
    <div className="container">
      <div className="setup">
        <h2 style={{ marginBottom: 12 }}>Nastavení</h2>
        <p className="mono" style={{ fontSize: '0.85rem' }}>
          Chybí <code>config.js</code> nebo API klíč.
        </p>
        <p style={{ marginTop: 12, color: 'var(--muted)' }}>
          Pro lokální vývoj uprav <code>public/config.js</code>:
        </p>
        <pre>{`window.__CMS_CONFIG__ = {
  apiUrl: "https://your-backend.azurecontainerapps.io/api/v1/public",
  apiKey: "cms_your_api_key_here",
  siteTitle: "flajsman.cz",
  postsSlug: "blog-post",
  contactFormSlug: "contact-us",
};`}</pre>
        <p style={{ marginTop: 16, color: 'var(--muted)' }}>
          V produkci se hodnoty generují z GitHub secrets při nasazení.
        </p>
      </div>
    </div>
  );
}
