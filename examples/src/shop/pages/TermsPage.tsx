import { usePage } from '../../hooks/usePosts';
import { RichText } from '../../components/RichText';
import { ErrorState, Spinner } from '../../components/Spinner';

/** Terms, seller details and withdrawal information, written by the shop owner as the CMS page "obchodni-podminky". */
export function TermsPage() {
  const { data: page, isLoading } = usePage('obchodni-podminky');
  return (
    <section className="article">
      <div className="container">
        <div className="kicker">obchodní podmínky</div>
        {isLoading && <Spinner />}
        {!isLoading && !page && <ErrorState message="Obchodní podmínky zatím nejsou k dispozici." />}
        {page && (
          <>
            {page.title && <h1>{page.title}</h1>}
            {page.body && (
              <div style={{ marginTop: 24 }}>
                <RichText html={page.body} />
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
