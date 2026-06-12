/**
 * Renders trusted rich-text HTML authored in TheCMS admin (the blog owner's
 * own content). Styling comes from the `.article-body` rules in global.css.
 */
export function RichText({ html }: { html: string }) {
  return <div className="article-body" dangerouslySetInnerHTML={{ __html: html }} />;
}
