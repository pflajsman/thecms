/** Shown when no real API config is present yet. */
export function Setup() {
  return (
    <div className="container">
      <div className="setup">
        <h1>Setup</h1>
        <p>
          <code>config.js</code> or the API key is missing. For local development, edit <code>public/config.js</code>:
        </p>
        <pre>{`window.__CMS_CONFIG__ = {
  apiUrl: "https://your-backend.azurecontainerapps.io/api/v1/public",
  apiKey: "cms_your_flajsmanlab_api_key",
  siteTitle: "FlajsmanLab",
  projectsSlug: "project",
  pagesSlug: "page",
};`}</pre>
        <p>In production the values are generated from GitHub secrets at deploy time.</p>
      </div>
    </div>
  );
}
