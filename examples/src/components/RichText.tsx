/**
 * Renders trusted rich-text HTML authored in TheCMS admin (the site owner's
 * own content). Styling comes from the `.prose` rules in global.css.
 */
export function RichText({ html }: { html: string }) {
  return <div className="prose" dangerouslySetInnerHTML={{ __html: html }} />;
}
